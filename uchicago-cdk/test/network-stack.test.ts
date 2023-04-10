import { SynthUtils } from '@aws-cdk/assert'
import { App } from '@aws-cdk/core'
import { NetworkStack } from '../src/network-stack'

test('NetworkStack - Check against snapshot', () => {
  const app = new App()
  // WHEN
  const stack: NetworkStack = new NetworkStack(app, 'MyTestStack', {environmentName: 'test'})
  // THEN
  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot()
})
