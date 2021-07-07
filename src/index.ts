import https from 'https'
import { execSync } from 'child_process'

type JiraState = 'pending' | 'in_progress' | 'successful' | 'cancelled' | 'failed' | 'rolled_back' | 'unknown'
type JiraRnvironmentType = 'production' | 'staging' | 'testing'
type JiraOptions = {
  cloudId: string
  clientId: string
  clientSecret: string
}

type DeploymentOptions = {
  buildNumber: number
  pipelineName: string
  pipelineUrl: string
  displayName: string
  status: JiraState
  environment: string
  environmentType: JiraRnvironmentType
  issueKeys?: string[]
  description?: string
  label?: string
  lastUpdated?: string
}

export class Jira {
  private hostname = "api.atlassian.com"
  private options: JiraOptions

  constructor(options: JiraOptions) {
    this.options = options
  }

  private request(method: 'GET' | 'POST' | 'DELETE', path: string, headers: any, data?: any) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.hostname,
        port: 443,
        path,
        method,
        headers,
      }
      const req = https.request(options, res => {
        let inData = ''
        res.on('data', (chunk) => {
          inData += chunk
        })
        res.on('end', () => {
          try {
            inData = JSON.parse(inData)
          } catch (error) {
            //
          }
          resolve(inData)
        })
      })
      req.on('error', error => {
        reject(error)
      })
      if (data) {
        req.write(JSON.stringify(data))
      }
      req.end()
    })
  }

  async accessToken() {
    const res = await this.request('POST', '/oauth/token', {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }, {
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
      grant_type: "client_credentials",
      audience: this.hostname,
    })
    return res['access_token']
  }
  
  get issueKeys() {
    const issueKeys = new Set()
    execSync('git log HEAD --oneline').toString().split('\n').forEach((commit) => {
      const keys = commit.match(/((?!([A-Z0-9a-z]{1,10})-?$)[A-Z]{1}[A-Z0-9]+-\d+)/g) || []
      keys.forEach((key) => {
        issueKeys.add(key)
      })
    })
    return Array.from(issueKeys)
  }

  async saveDeployment(options: DeploymentOptions) {
    const deployment = {
      schemaVersion: "1.0",
      deploymentSequenceNumber: options.buildNumber,
      updateSequenceNumber: options.buildNumber,
      issueKeys: options.issueKeys || this.issueKeys,
      displayName: options.displayName,
      url: options.pipelineUrl,
      description: options.description || `Deployment with build number ${options.buildNumber}`,
      lastUpdated: options.lastUpdated || new Date().toISOString(),
      label: options.label || options.pipelineName,
      state: options.status,
      pipeline: {
        id: options.buildNumber,
        displayName: options.pipelineName,
        url: options.pipelineUrl,
      },
      environment: {
        id: options.environment,
        displayName: options.environment,
        type: options.environmentType,
      }
    }
    return this.request('POST', `/jira/deployments/0.1/cloud/${this.options.cloudId}/bulk`, {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': "Bearer " + await this.accessToken(),
    }, {
      deployments: [deployment]
    })
  }

  async deleteDeployment(pipelineId: string, environmentId: string, deploymentSequenceNumber: number) {
    return this.request('DELETE', `/jira/deployments/0.1/cloud/${this.options.cloudId}/pipelines/${pipelineId}/environments/${environmentId}/deployments/${deploymentSequenceNumber}`, {
      'Authorization': "Bearer " + await this.accessToken(),
    })
  }

  async getDeployment(pipelineId: string, environmentId: string, deploymentSequenceNumber: number) {
    return this.request('GET', `/jira/deployments/0.1/cloud/${this.options.cloudId}/pipelines/${pipelineId}/environments/${environmentId}/deployments/${deploymentSequenceNumber}`, {
      'Authorization': "Bearer " + await this.accessToken(),
    })    
  }
}