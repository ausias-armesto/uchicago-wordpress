import { Stack, Construct, Tags } from '@aws-cdk/core'
import { IVpc, Peer, Port, SecurityGroup, SubnetType, Vpc } from '@aws-cdk/aws-ec2'
import { FileSystem, LifecyclePolicy, PerformanceMode, OutOfInfrequentAccessPolicy, AccessPoint } from '@aws-cdk/aws-efs';
import { WordpressStackProps } from './wordpress-stack-props';

/**
 * Custom Properties for the EFS Stack
 */
 export interface EFSStackProps extends WordpressStackProps {
}

/**
 * Construct EFS File System resource on AWS
 */
export class EFSStack extends Stack {

  private props: EFSStackProps;
  private vpc: IVpc;
  public fileSystem: FileSystem;
  public securityGroup: SecurityGroup;
  private accessPoint: AccessPoint;

  constructor(scope: Construct, id: string, props?: EFSStackProps) {
    super(scope, id, props)
    this.props = props!;

    this.vpc = Vpc.fromLookup(this, 'vpc', { vpcName: 'vpc-' + this.props.environmentName })

    this.createSecurityGroup()
    this.createEFS()
  }

  private createSecurityGroup(): void {
    const securityGroupName = `secg-efs-${this.props.environmentName}`
    this.securityGroup = new SecurityGroup(this,securityGroupName,{ 
      vpc: this.vpc,
      securityGroupName,
      description: 'Security Group for EFS'
     })
     this.securityGroup.addIngressRule(Peer.ipv4('10.0.0.0/16'), Port.tcp(2049), 'Allow NFS access within the VPC')
  }

  /**
   * Creates a NFS Share
   * @returns 
   */
  private createEFS(): void {
    const fileSystemName = `efs-${this.props.environmentName}`
    this.fileSystem = new FileSystem(this, fileSystemName, {
      vpc: this.vpc,
      fileSystemName,
      encrypted: true,
      securityGroup: this.securityGroup,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_NAT
      }
    });
    //this.accessPoint = this.fileSystem.addAccessPoint('RootAccessPoint');
    //Tags.of(this.accessPoint).add('Name','RootAccessPoint');
  }

  

}
