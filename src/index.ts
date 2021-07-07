import axios from 'axios'

class Jira {
  private host = "https://api.atlassian.com"
  private cloudId = process.env['JIRA_CLOUD_ID']
  private clientId = process.env['JIRA_CLIENT_ID']
  private clientSecret = process.env['JIRA_CLIENT_SECRET']

  private async accessToken() {
    const res = await axios.post(`${this.host}/oauth/token`, {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "client_credentials",
      audience: this.host.split('//')[1],
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    })
    return res.data.access_token
  }
}