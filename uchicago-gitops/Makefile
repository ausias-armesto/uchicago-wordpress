flux-install:
	flux check --pre && \
	flux bootstrap github --owner=`git config user.name` --repository=uchicago-gitops --branch=master --path=./clusters/k8s-$(env) --personal

create-master-sealed-secret:
	cd ./clusters/k8s-$(env)/security/ && \
	openssl req -x509 -sha256 -nodes -days 3650 -newkey rsa:2048 -keyout privateKey.key -out sealed-secret-public-key.pem -subj "/C=US/ST=Illinois/L=Chicago/O=University of Chicago/CN=Course Devops/emailAddress=ausiasarmesto@gmail.com" && \
	cp sealed-secret-private-key.yaml.template ./sealed-secret-private-key.yaml && \
	certValue=`cat sealed-secret-public-key.pem | base64` yq -i '.data."tls.crt" = env(certValue)' ./sealed-secret-private-key.yaml && \
	certValue=`cat privateKey.key | base64` yq -i '.data."tls.key" = env(certValue)' ./sealed-secret-private-key.yaml && \
	echo "$(password)" > .vault_pass && \
	echo "$(password)" | gpg --batch --yes --passphrase-fd 0 --symmetric --cipher-algo AES256 ./sealed-secret-private-key.yaml && \
	rm ./privateKey.key ./sealed-secret-private-key.yaml && \
	git commit -m "Updating Master selead secret" ./sealed-secret-public-key.pem ./sealed-secret-private-key.yaml.gpg && \
	git push

regenerate-master-sealed-secret:
	cd ./clusters/k8s-$(env)/security/ && \
	cat .vault_pass | gpg --quiet --batch --yes --decrypt --passphrase-fd 0 ./sealed-secret-private-key.yaml.gpg | kubectl apply -f - && \
	kubectl scale deployment -n flux-system sealed-secrets-controller --replicas=0 && \
	sleep 5 && \
	kubectl scale deployment -n flux-system sealed-secrets-controller --replicas=1


MYSQL_WORDPRESS_PASSWORD := $(shell aws secretsmanager get-secret-value --secret-id wordpress-mysql-uchicago-$(env) --query SecretString --output text | jq -r .password)
create-mysql-secret:
	cd clusters/k8s-$(env) && \
	kubectl -n wordpress create secret generic mysql-database-secret --from-literal=mariadb-password='$(MYSQL_WORDPRESS_PASSWORD)' --dry-run=client -o yaml > ./wordpress/mysql-database-secret.yaml && \
	kubeseal --format=yaml --cert=./security/sealed-secret-public-key.pem < ./wordpress/mysql-database-secret.yaml > ./wordpress/mysql-database-secret-sealed.yaml && \
	kubectl apply -f ./wordpress/mysql-database-secret-sealed.yaml && \
	rm -rf ./wordpress/mysql-database-secret.yaml ./wordpress/mysql-database-secret-sealed.yaml

ADMIN_WORDPRESS_PASSWORD := $(shell aws secretsmanager get-secret-value --secret-id admin-wordpress-uchicago-$(env) --query SecretString --output text | jq -r .password)
create-wordpress-secret:
	cd clusters/k8s-$(env) && \
	kubectl -n wordpress create secret generic wordpress-admin-secret --from-literal=wordpress-password='$(ADMIN_WORDPRESS_PASSWORD)' --dry-run=client -o yaml > ./wordpress/wordpress-admin-secret.yaml && \
	kubeseal --format=yaml --cert=./security/sealed-secret-public-key.pem < ./wordpress/wordpress-admin-secret.yaml > ./wordpress/wordpress-admin-secret-sealed.yaml && \
	kubectl apply -f ./wordpress/wordpress-admin-secret-sealed.yaml && \
	rm -rf ./wordpress/wordpress-admin-secret.yaml ./wordpress/wordpress-admin-secret-sealed.yaml

restart-wordpress: 
	kubectl scale deployment --namespace=wordpress wordpress --replicas=0 && \
	sleep 5 && \
	kubectl scale deployment --namespace=wordpress wordpress --replicas=1

refresh-secrets: regenerate-master-sealed-secret create-mysql-secret create-wordpress-secret restart-wordpress

update-efs:
	efs_id=`aws efs describe-file-systems --query "FileSystems[0].FileSystemId" --output text` yq -i '.spec.csi.volumeHandle = env(efs_id)' ./clusters/k8s-$(env)/wordpress/wordpress-pv.yaml && \
	git commit -m "Updating EFS ID" ./clusters/k8s-$(env)/wordpress/wordpress-pv.yaml && \
	git push

flux-uninstall:
	flux uninstall && \
	kubectl delete namespace monitoring && \
	kubectl delete namespace wordpress && \
	kubectl delete deployment -n kube-system metrics-server