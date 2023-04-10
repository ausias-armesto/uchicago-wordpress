import { Stack, Construct, RemovalPolicy } from '@aws-cdk/core'
import { Secret } from '@aws-cdk/aws-secretsmanager';
import { WordpressStackProps } from './wordpress-stack-props';


/**
 * Construct all Secrets resources on AWS
 */
export class SecretsStack extends Stack {

  private props: WordpressStackProps;

  constructor(scope: Construct, id: string, props?: WordpressStackProps) {
    super(scope, id, props)
    this.props = props!;
    this.createSecret(`root-mysql-uchicago-${this.props.environmentName}`, 'root', `Root user for Mysql database on ${this.props.environmentName}`)
    this.createSecret(`wordpress-mysql-uchicago-${this.props.environmentName}`, 'root', `Wordpress user for Mysql database on ${this.props.environmentName}`)
    this.createSecret(`admin-wordpress-uchicago-${this.props.environmentName}`, 'admin', `Admin user for Wordpress App on ${this.props.environmentName}`)

  }

  /**
   * Creates a Secret
   * @returns 
   */
  private createSecret(secretName: string, user: string, description: string): Secret {
    return new Secret(this, secretName, {
      secretName: secretName,
      description: description,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: user }),
        generateStringKey: 'password',
        requireEachIncludedType: false,
        excludePunctuation: false,
        excludeCharacters: '"`\'\\'
      },
      removalPolicy: RemovalPolicy.DESTROY
    })
  }

}
