# The Univerisity of Chicago - Devops Course - Git Ops Repository

## Introduction

This repository has been created as part of the contents for the [Devops Course](https://online.professional.uchicago.edu/course/dtb-dev/) at the [The Univerisity of Chicago](https://online.professional.uchicago.edu/) as an Teacher Assistant.

This repository holds the Kubernetes manifests of the apps to be deployed on Kubernetes. It uses [Flux CD](https://fluxcd.io/) as a continuous delivery tool over Kubernetes.

## Prerequisites

- Installed Kubectl v1.23.1
- Installed Fluxcd 0.28.3
- Installed kubeseal v0.17.2
- Installed yq v4.24.2

## Apps Installed on the Repository

- **Flux CD**: Contains the [Flux CD](https://fluxcd.io/) manifests that governs the cluster
- **Prometheus and Grafana**: On the _monitoring_ folder are stored the manifest to deploy Prometheus and Grafana.
- **Security**: As the Cluster needs to be recreated in case of disaster, in the folder _security_ it is stored the secrets that will be managed by [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
- **Wordpress**: Contains the Helm Release for Wordpress
- **Load Test**: The folder Load Test contains the configuration to add Horizontal Pod Autoscaler feature to the Wordpress Helm Release, and besides starts running a deployment that will inject load into the Wordpress App.



## Commands

* `make create-master-sealed-secret env=dev password=XXXXXXX`: This command is used only once to encrypt the master Sealed Secret and push it to the repository. Once the master sealed secret is uploaded encrypted in the repository you don't need to execute it again.
* `make update-efs env=dev`: Updates the EFS FileSystem ID before installing Flux
* `export GITHUB_TOKEN=<my-github-credentials-token>`: Export the Credentials token in an environment variable which will be used by Flux
* `make flux-install env=dev`: Install all the apps on the Kubernetes cluster (FluxCD, Sealed Secrets, Prometheus, Grafana, Wordpress). Change the _ghuser_ with the name of your Github forked repository user.
* `make refresh-secrets env=dev`: Takes the encrypted master sealed secret pushed into the repository and applies it into the new cluster. Besides it creates the secrets for Mysql and Wordpress.
* `make flux-uninstall`: Deletes all Kubernetes resources installed on the cluster.

## Screenshots

### Initialize Kubernetes

![Flux](./images/k8s_flux.png)


### Wordpress

![Wordpress App](./images/app_wordpress.png)

![Wordpress K8s resources](./images/k8s_wordpress.png)

### Prometheus and Grafana

![Prometheus K8s resources](./images/k8s_prometheus.png)

![Grafana App](./images/app_grafana.png)
