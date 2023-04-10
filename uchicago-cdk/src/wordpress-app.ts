import { App } from '@aws-cdk/core'
import { NetworkStack } from './network-stack'
import { MysqlStack } from './mysql-stack'
import { EksStack } from './eks-stack'
import { SecretsStack } from './secrets-stack'
import { WordpressStackProps } from './wordpress-stack-props'
import { SdkUtils } from './sdk-utils'
import { EFSStack } from './efs-stack'

export class WordpressApp {

  private sdkUtils: SdkUtils;
  private app: App;
  private props: WordpressStackProps


  constructor() {
    this.app = new App()
    this.sdkUtils = new SdkUtils()
    this.props = {
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: this.app.node.tryGetContext('region') || process.env.CDK_DEFAULT_REGION
      },
      environmentName: this.app.node.tryGetContext('environmentName')
    } as WordpressStackProps
  }

  /**
   * Build the CDK Application
   */
  public async buildCdkApp() {
    const stackName = this.app.node.tryGetContext('stackName')
    switch (stackName) {
      case 'secrets':
        new SecretsStack(this.app, `wordpress-secrets-${this.props.environmentName}`, this.props)
        break;
      case 'network':
        new NetworkStack(this.app, 'wordpress-vpc-' + this.props.environmentName, this.props)
        break;
      case 'mysql':
        await this.createMySQLStack()
        break;
      case 'efs':
        new EFSStack(this.app, 'wordpress-efs-' + this.props.environmentName, this.props)
        break;        
      case 'kubernetes':
        await this.createEKSStack()
        break;
      case 'infrastructure':
        const mysqlStackPromise = this.createMySQLStack()
        const eksStackPromise = this.createEKSStack()
        await Promise.all([mysqlStackPromise, eksStackPromise])
        break;
      default:
        throw new Error(`Incorrect stack name ${stackName}`)
    }
  }

  /**
   * Creates the EKS Stack
   */
  private async createEKSStack() {
    const efsStack = new EFSStack(this.app, 'wordpress-efs-' + this.props.environmentName, this.props)
    new EksStack(this.app, 'wordpress-k8s-' + this.props.environmentName, {...this.props, efsSecurityGroup: efsStack.securityGroup, efsId: efsStack.fileSystem.fileSystemId})
  }

  /**
   * Create the MySQL Stack
   */
  private async createMySQLStack() {
    const rootPassword = await this.sdkUtils.getSecret(`root-mysql-uchicago-${this.props.environmentName}`)
    const wordpressPassword = await this.sdkUtils.getSecret(`wordpress-mysql-uchicago-${this.props.environmentName}`)
    const mysqlStackProps = {...this.props, rootPassword, wordpressPassword }
    new MysqlStack(this.app, 'wordpress-mysql-' + this.props.environmentName, mysqlStackProps)
  }

}
