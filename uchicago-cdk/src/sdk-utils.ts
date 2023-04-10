var AWS = require("aws-sdk");

export class SdkUtils {

  private secretsmanager: any;

  constructor() {
    AWS.config.getCredentials(function (err: any) {
      if (err) console.log(err.stack);
    });
    this.secretsmanager = new AWS.SecretsManager();
  }


  /**
   * Get a secret created on AWS
   * @param secretName The name of the secret
   * @returns The given password of the secret
   */
  public async getSecret(secretName: string): Promise<string> {
    var getSecretParams = {
      SecretId: secretName
    };    
    return new Promise((resolve, reject) => {
      this.secretsmanager.getSecretValue(getSecretParams, function (err: any, data: any) {
        if (err) {
          reject(err)
        } else { // Retrieving an existing secret          
          resolve(JSON.parse(data.SecretString).password)
        }
      });
    })
  }


}
