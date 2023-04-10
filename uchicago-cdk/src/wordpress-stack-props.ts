import { StackProps } from '@aws-cdk/core'


/**
 * Wordpress stack Props
 */
export interface WordpressStackProps extends StackProps {
  environmentName: string;
}

