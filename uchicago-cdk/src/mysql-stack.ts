import { Stack, Construct, Duration, Tags, RemovalPolicy } from '@aws-cdk/core'
import {
  Instance, InstanceType, MachineImage, CloudFormationInit, InitFile,
   IVpc, Vpc, SecurityGroup, InitCommand, Peer, Port, SubnetType
} from '@aws-cdk/aws-ec2'
import { KeyPair } from 'cdk-ec2-key-pair'
import { LogGroup, RetentionDays } from '@aws-cdk/aws-logs'
import { ARecord, HostedZone, RecordTarget } from '@aws-cdk/aws-route53';
import { WordpressStackProps } from './wordpress-stack-props';

/**
 * Custom Properties for the Mysql Stack
 */
 export interface MysqlStackProps extends WordpressStackProps {
  rootPassword: string;
  wordpressPassword: string;
}

/**
 * Construct all Mysql resources on AWS
 */
export class MysqlStack extends Stack {

  private props: MysqlStackProps;
  private keyPair: KeyPair
  private mysqlInstance: Instance;
  private vpc: IVpc;

  constructor(scope: Construct, id: string, props?: MysqlStackProps) {
    super(scope, id, props)
    this.props = props!;

    this.vpc = Vpc.fromLookup(this, 'vpc', { vpcName: 'vpc-' + this.props.environmentName })

    //this.createLogGroup()
    this.keyPair = this.createKeyPair()
    this.mysqlInstance = this.createEc2Instance()
    this.addDNS()

  }

  /**
   * Creates a LogGroup to send SSM Logs
   * @returns 
   */
  private createLogGroup(): LogGroup {
    return new LogGroup(this, 'log-group-ec2', {
      logGroupName: '/aws/ssm/managed-instances',
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY
    })
  }

  /**
   * Creates a EC2 KeyPair to access the EC2 Instances
   * @returns 
   */
  private createKeyPair(): KeyPair {
    const name = `mysql-key-pair-${this.props.environmentName}`
    const key = new KeyPair(this, name, {
      name,
      description: `Key pair to access Mysql instance on ${this.props.environmentName} environment`,
      storePublicKey: true, // by default the public key will not be stored in Secrets Manager
    });
    return key
  }

  /**
   * Creates the conent of the initial SQL commands to execute the first time on the server
   */
   private createSqlContent() {
    return `
      CREATE USER 'wordpress'@'localhost' IDENTIFIED BY '${this.props.wordpressPassword}';
      GRANT ALL PRIVILEGES ON *.* TO 'wordpress'@'localhost' WITH GRANT OPTION;
      CREATE USER 'wordpress'@'10.0.%' IDENTIFIED BY '${this.props.wordpressPassword}';
      GRANT ALL PRIVILEGES ON *.* TO 'wordpress'@'10.0.%' WITH GRANT OPTION;
      CREATE DATABASE wordpress;
      FLUSH PRIVILEGES;
    `
  }

  /**
   * Creates the conent of the bash script
   */
   private createBashContent() {
    return `
    #!/bin/bash
    mysql --connect-expired-password -u root -p'${this.props.rootPassword}' < /tmp/mysql-init-config.sql
    `
  }  

  /**
   * Creates a EC2 instance with MySQL server
   * @returns 
   */
  private createEc2Instance() {
    const machineImage = MachineImage.lookup({
      name: 'uchicago-mysql-*',
      filters: { "tag:Name": ["wordpress-mysql-db"] }
    })
    const securityGroup = this.createSecurityGroup()
    const instanceType = new InstanceType(this.node.tryGetContext('mysqlInstanceType') || 't3.small' )
    const sqlFilepath = '/tmp/mysql-init-config.sql';
    const bashFilepath = '/tmp/mysql-init-config.sh';
    return new Instance(this, 'mysql-ec2-Instance', {
      vpc: this.vpc,
      // It should be in a PRIVATE_ISOLATED subnet, but Cloudformation needs the init scripts to communicate with Cloudformation to inform about the execution result status
      // and for doing that it needs internet connection
      vpcSubnets: this.vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_NAT }),
      instanceType,
      machineImage,
      keyName: this.keyPair.keyPairName,
      securityGroup,
      init: CloudFormationInit.fromElements(
        InitFile.fromString(sqlFilepath, this.createSqlContent()),
        InitFile.fromString(bashFilepath, this.createBashContent()),
        InitCommand.argvCommand(['chmod', '+x', bashFilepath]),
        InitCommand.argvCommand(['bash', bashFilepath]),
        InitCommand.argvCommand( ['rm', '-rf', sqlFilepath, bashFilepath])
      ),
      initOptions: {
        // Optional, how long the installation is expected to take (5 minutes by default)
        timeout: Duration.minutes(30),
        // Optional, whether to include the --url argument when running cfn-init and cfn-signal commands (false by default)
        includeUrl: true,
        // Optional, whether to include the --role argument when running cfn-init and cfn-signal commands (false by default)
        includeRole: true,
      },
    });
  }

  /**
  * Creates a Security Group assigned to the Subnet created
  * @returns 
  */
  private createSecurityGroup(): SecurityGroup {
    const securityGroupName = 'secg-mysql-' + this.props.environmentName
    const sg = new SecurityGroup(this, securityGroupName, {
      securityGroupName: securityGroupName,
      vpc: this.vpc,
      description: 'Security Group for Mysql EC2 instance'
    })

    // Allow MySQL access
    sg.addIngressRule(Peer.ipv4('10.0.0.0/16'), Port.tcp(3306), 'Allow MySQL to VPC')
    sg.addIngressRule(Peer.ipv4('85.59.152.72/32'), Port.tcp(3306), 'Allow MySQL from home')

    // Access from home
    sg.addIngressRule(Peer.ipv4('85.59.152.72/32'), Port.tcp(22), 'Allow SSH access from home')

    Tags.of(sg).add('Name', securityGroupName)
    return sg
  }

  private addDNS() {
    const environmentHostedZone = HostedZone.fromLookup(this,'HostedZone',{
      domainName: `${this.props.environmentName}.wordpress.uchicago.local`,
      privateZone: true,
      vpcId: this.vpc.vpcId
    });

    const mysqlDnsEntry = new ARecord(this,'mysql-record-dns', {
      target: RecordTarget.fromIpAddresses(this.mysqlInstance.instancePrivateIp),
      recordName: 'mysql',
      zone: environmentHostedZone
    })
    
  }

}
