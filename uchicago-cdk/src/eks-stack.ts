import { Stack, App, Duration } from '@aws-cdk/core';
import { Vpc, SubnetType, InstanceType, SecurityGroup, Peer, Port } from '@aws-cdk/aws-ec2';
import { KubernetesVersion, EndpointAccess, Cluster, NodegroupAmiType, MachineImageType, ServiceAccount, HelmChart } from '@aws-cdk/aws-eks';
import { Role, AccountRootPrincipal, PolicyDocument, PolicyStatement, Effect, ServicePrincipal } from '@aws-cdk/aws-iam';
import { WordpressStackProps } from './wordpress-stack-props';


/**
 * Custom Properties for the EKS Stack
 */
 export interface EFSStackProps extends WordpressStackProps {
   efsId: string;
   efsSecurityGroup: SecurityGroup
}

export class EksStack extends Stack {

    private props: EFSStackProps;
    private cluster: Cluster;
    private clusterName: string;
    private serviceAccountName: string;
    private describeEfsPolicyStatement: PolicyStatement;
    private createEfsPolicyStatement: PolicyStatement;
    private deleteEfsPolicyStatement: PolicyStatement;
    constructor(scope: App, id: string, props: EFSStackProps) {
        super(scope, id, props);
        this.props = props;
        this.clusterName = 'k8s-' + this.props.environmentName;
        this.createPolicyStatements();
        this.createCluster()
        this.createAutoScalingGroup()
        this.createEFSServiceAccount()
        this.addCSIDriver()
        this.createStorageClass()
    }


    /**
     * Creates a EKS Cluster
     */
    private createCluster(): void {
        // cluster master role
        const masterRole = new Role(this, this.clusterName + '-master-role', {
            assumedBy: new AccountRootPrincipal(),
        });
        const vpc = Vpc.fromLookup(this,'vpc',{vpcName: 'vpc-' + this.props.environmentName})
        // Create a EKS cluster with Fargate profile.
        this.cluster = new Cluster(this, `eks-${this.clusterName}`, {
            version: KubernetesVersion.V1_21,
            mastersRole: masterRole,
            clusterName: this.clusterName,
            outputClusterName: true,
            defaultCapacity: 0,
            outputMastersRoleArn: true,
            endpointAccess: EndpointAccess.PUBLIC, // In Enterprise context, you may want to set it to PRIVATE.
            vpc,
            vpcSubnets: [{ subnetType: SubnetType.PRIVATE_WITH_NAT }]
        });


          
    }

    private createPolicyStatements() {
      this.describeEfsPolicyStatement = new PolicyStatement({
        resources: ['*'],
        actions: [
          'elasticfilesystem:DescribeAccessPoints',
          'elasticfilesystem:DescribeFileSystems'
        ],
        effect: Effect.ALLOW,
      })
      this.createEfsPolicyStatement = new PolicyStatement({
        resources: ['*'],
        actions: [
          'elasticfilesystem:CreateAccessPoint'
        ],
        effect: Effect.ALLOW,
      })
      this.deleteEfsPolicyStatement = new PolicyStatement({
        resources: ['*'],
        actions: [
          'elasticfilesystem:DeleteAccessPoint'
        ],          
        effect: Effect.ALLOW,
      });
      //const efsPolicyDocument = new PolicyDocument({ statements: [ this.describeEfsPolicyStatement, this.createEfsPolicyStatement, this.deleteEfsPolicyStatement ] });
    }

    private createAutoScalingGroup() {
      const autoScalingGroupName = `asg-k8s-${this.props.environmentName}`          
      const autoscalingGroup = this.cluster.addAutoScalingGroupCapacity(autoScalingGroupName,{
        instanceType: new InstanceType(this.node.tryGetContext('clusterInstanceType') || 't3.small'),
        autoScalingGroupName, 
        minCapacity: this.node.tryGetContext('clusterMinCapacity') || 2,
        maxCapacity: this.node.tryGetContext('clusterMaxCapacity') || 4,
        desiredCapacity: this.node.tryGetContext('clusterDesiredCapacity') || 2,
        machineImageType: MachineImageType.AMAZON_LINUX_2           
      })
      autoscalingGroup.scaleOnCpuUtilization('cpuUtilization', {
        targetUtilizationPercent: this.node.tryGetContext('clusterCpuUtilization') || 30,
        cooldown: Duration.minutes(this.node.tryGetContext('clusterCoolDownMinutes') || 2)
      })
      autoscalingGroup.addToRolePolicy
      autoscalingGroup.addSecurityGroup(this.props.efsSecurityGroup)

    }

    private createEFSServiceAccount(){

      // 👇 Create a Policy Document (Collection of Policy Statements)
      //
      this.serviceAccountName= `efs-sa`
      const serviceAccount = new ServiceAccount(this, this.serviceAccountName, {
        cluster: this.cluster,
        name: this.serviceAccountName,
        namespace: 'kube-system'
      })
      serviceAccount.addToPrincipalPolicy(this.describeEfsPolicyStatement)
      serviceAccount.addToPrincipalPolicy(this.createEfsPolicyStatement)
      serviceAccount.addToPrincipalPolicy(this.deleteEfsPolicyStatement)
    }


    private addCSIDriver() {

      new HelmChart(this, 'aws-efs-csi-driver', {
        cluster: this.cluster,
        chart: 'aws-efs-csi-driver',
        repository: 'https://kubernetes-sigs.github.io/aws-efs-csi-driver/',
        namespace: 'kube-system',
        release: 'v1.3.6',
        values: {
          'image.repository': `${this.props.env?.account}.dkr.ecr.${this.props.env?.region}.amazonaws.com/eks/aws-efs-csi-driver`,
          'controller.serviceAccount.create': false,
          'controller.serviceAccount.name': this.serviceAccountName
        }
      });

    }

    private createStorageClass() {

      const namespace = this.cluster.addManifest('storage-class', {
        apiVersion: 'storage.k8s.io/v1',
        kind: 'StorageClass',
        metadata: { 
          name: 'efs-sc',
          namespace: 'kube-system'
        },
        provisioner: 'efs.csi.aws.com',
        reclaimPolicy: 'Retain',
        volumeBindingMode: 'WaitForFirstConsumer',
        parameters: {
          'provisioningMode': 'efs-ap',
          'fileSystemId': this.props.efsId,
          'directoryPerms': '700',
          'gidRangeStart': '1000',
          'gidRangeEnd': '2000',
          'basePath': '/data'
        }
      });
    }

}
