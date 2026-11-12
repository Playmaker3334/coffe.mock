terraform {
  required_version = ">= 1.6"
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

provider "digitalocean" {}

variable "region" {
  default = "sfo3"
}

variable "size" {
  default = "s-1vcpu-512mb-10gb"
}

variable "deploy_public_key_path" {
  default = "~/.ssh/coffe_deploy.pub"
}

resource "digitalocean_ssh_key" "deploy" {
  name       = "coffe-deploy"
  public_key = file(pathexpand(var.deploy_public_key_path))
}

resource "digitalocean_droplet" "web" {
  name        = "coffe-mock"
  image       = "ubuntu-24-04-x64"
  region      = var.region
  size        = var.size
  ssh_keys    = [digitalocean_ssh_key.deploy.id]
  resize_disk = false
  user_data   = file("${path.module}/cloud-init.yaml")
}

resource "digitalocean_firewall" "web" {
  name        = "coffe-mock-fw"
  droplet_ids = [digitalocean_droplet.web.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

output "ip" {
  value = digitalocean_droplet.web.ipv4_address
}

output "url" {
  value = "https://${replace(digitalocean_droplet.web.ipv4_address, ".", "-")}.sslip.io"
}
