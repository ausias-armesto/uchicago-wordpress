# The Univerisity of Chicago - Devops Course - AWS MYSQL AMI 

## Introduction

This repository has been created as part of the contents for the [Devops Course](https://online.professional.uchicago.edu/course/dtb-dev/) at the [The Univerisity of Chicago](https://online.professional.uchicago.edu/) as an Teacher Assistant.

The purpose of this repository is to show an example of how to use the Packer technology to create AWS AMI images. The AMI generated is based on an Amazon Linux 2 OS with MySql Community 5.7

## Important

<img src='https://toppng.com/uploads/preview/warning-vectors-and-icons-warning-svg-icon-11553508662kccnngsukp.png' width='16'>
Recall to delete the AMI and it associated snapshot to not incur in undesirable costs once you have finished testing with it

## Prerequisites

- Installed AWS Cli 2.2.12
- Installed Packer 1.7.2

## Commands

Run the packer build, which will take a few minutes:

```
packer build --debug packer.json
AMI_ID=$(jq -r '.builds[-1].artifact_id' manifest.json | cut -d ":" -f2)  
```

## Github Actions

On every push to branch master or develop a new image is created, with some predefined values.
It has been assumed that the develop branch would hold the 'dev' environment and the master branch would hold the 'pre' environment. The image is generated in different regions (eu-west-1, eu-west-2) depending on the branch

To be able to run successfully, remind that you need to have configured on your forked repository the following secrets with its corresponding values to connect to AWS:
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY

See them on [Github Actions](https://github.com/ausias-armesto/uchicago-packer/actions)
