#!/usr/bin/env node
import 'source-map-support/register'
import { WordpressApp } from './wordpress-app'

const wordpressApp: WordpressApp = new WordpressApp()
wordpressApp.buildCdkApp()