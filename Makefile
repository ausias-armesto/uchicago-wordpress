
check:
	aws sts get-caller-identity && \
	packer --version && \
	flux --version && \
	yq --version && \
	kubeseal --version && \
	kubectl > /dev/null

prepare:
	cd uchicago-cdk && \
	npm run clean && \
	npm run refresh && \
	npm run build && \
	npm run test
	cd uchicago-packer && \
	rm -f manifest.json

create-secrets:
	cd uchicago-cdk && \
	npx cdk deploy --require-approval never --context stackName=secrets --context environmentName=$(env) --context region=$(region)

deploy-network:
	cd uchicago-cdk && \
	npx cdk deploy --require-approval never --context stackName=network --context environmentName=$(env) --context region=$(region)


AMI_ID := $(shell aws ec2 describe-images --filters Name=tag:Type,Values=uchicago-mysql --output text --query "Images[0].ImageId")
SNAPSHOT_ID_OS := $(shell aws ec2 describe-images --filters Name=tag:Type,Values=uchicago-mysql  --output text --query "Images[0].BlockDeviceMappings[?(@.DeviceName == '/dev/xvda')].Ebs.SnapshotId")
MYSQL_ROOT_PASSWORD := $(shell aws secretsmanager get-secret-value --secret-id root-mysql-uchicago-$(env) --query SecretString --output text | jq -r ".password")
        
create-ami:
	if [ "$(AMI_ID)" != "None" ]; then aws ec2 deregister-image --image-id=$(AMI_ID); aws ec2 delete-snapshot --snapshot-id=$(SNAPSHOT_ID_OS); fi
	cd uchicago-packer && \
	packer build -var 'region=$(region)' -var 'environmentName=$(env)' -var 'mysqlRootPassword=$(MYSQL_ROOT_PASSWORD)' packer.json

deploy-mysql:
	cd uchicago-cdk && \
	npx cdk deploy --require-approval never --context stackName=mysql --context environmentName=$(env) --context region=$(region) --no-rollback && \
	rm -f ec2-mysql.key && \
	aws secretsmanager get-secret-value --secret-id ec2-ssh-key/mysql-key-pair-$(env)/private --query SecretString --output text > ec2-mysql.key && \
	chmod 400 ec2-mysql.key

deploy-kubernetes:
	cd uchicago-cdk && \
	npx cdk deploy --require-approval never --context stackName=kubernetes --context environmentName=$(env) --context region=$(region) --no-rollback --all

deploy-infrastructure:
	cd uchicago-cdk && \
	npx cdk deploy --require-approval never --all --context stackName=infrastructure --context environmentName=$(env) --context region=$(region) --no-rollback

KUBECTL_UPDATE_COMMAND := $(shell aws cloudformation describe-stacks --stack-name wordpress-k8s-$(env) --output json  | jq .Stacks[0].Outputs | grep 'aws eks update-kubeconfig' | sed 's/.*"aws/aws/' | sed 's/"$\//')
configure-kubernetes:
	cd uchicago-cdk && \
	npm run kubernetes:config && \
	kubectl config set-context --current --namespace=wordpress

flux:
	cd ./uchicago-gitops && \
	make update-efs && \
	make flux-install && \
	make refresh-secrets

load-test-start:
	cd uchicago-gitops && \
	kubectl apply -f ./clusters/load-test/

load-test-stop:
	kubectl delete deployment -n wordpress load-test	
	
enable-access-grafana: 
	kubectl -n monitoring port-forward svc/kube-prometheus-stack-grafana 3000:80

enable-access-wordpress: 	
	kubectl -n wordpress port-forward svc/wordpress 4000:80

all: check clean create-secrets deploy-network create-ami deploy-infrastructure flux
