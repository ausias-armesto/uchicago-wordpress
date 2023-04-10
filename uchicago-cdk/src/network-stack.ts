import { Stack, Construct, Tags } from '@aws-cdk/core'
import { Vpc, SubnetType } from '@aws-cdk/aws-ec2'
import { HostedZone } from '@aws-cdk/aws-route53';
import { WordpressStackProps } from './wordpress-stack-props';


/**
 * Construct all networking resources on AWS
 */
export class NetworkStack extends Stack {

  private props: WordpressStackProps;
  private vpc: Vpc

  constructor(scope: Construct, id: string, props?: WordpressStackProps) {
    super(scope, id, props)
    this.props = props!;
    this.vpc  = this.createVpc()
    this.createHostedZone()

  }

  /**
   * Creates the VPC, Subnets, routing tables, Internet Gateway
   * @returns 
   */
  private createVpc (): Vpc {
    const vpc = new Vpc(this, 'VPC', {
      cidr: '10.0.0.0/16',
      enableDnsHostnames: true,
      enableDnsSupport: true,
      maxAzs: 3,      
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Private-',
          subnetType: SubnetType.PRIVATE_WITH_NAT
        },
        {
          cidrMask: 24,
          name: 'Public-',
          subnetType: SubnetType.PUBLIC
        }                       
      ]
   });
   Tags.of(vpc).add('Name','vpc-' + this.props.environmentName)
   return vpc
  }

  private createHostedZone() {
    const environmentHostedZone = new HostedZone(this, 'HostedZone', {
      zoneName: `${this.props.environmentName}.wordpress.uchicago.local`,
      comment: `Hosted zone for Wordpress ${this.props.environmentName} environment`
    });
    environmentHostedZone.addVpc(this.vpc)
  }

}
