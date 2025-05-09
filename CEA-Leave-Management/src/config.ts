const config = {
  MicrosoftAppId: process.env.BOT_ID,
  MicrosoftAppType: process.env.BOT_TYPE,
  MicrosoftAppTenantId: process.env.BOT_TENANT_ID,
  MicrosoftAppPassword: process.env.BOT_PASSWORD,
  azureOpenAIKey: process.env.AZURE_OPENAI_API_KEY,
  azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
  azureOpenAIDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  aadAppClientId: process.env.AAD_APP_CLIENT_ID,
  aadAppClientSecret: process.env.AAD_APP_CLIENT_SECRET,
  aadAppOauthAuthorityHost: process.env.AAD_APP_OAUTH_AUTHORITY_HOST,
  aadAppTenantId: process.env.AAD_APP_TENANT_ID,
  botDomain: process.env.BOT_DOMAIN,
  aadAppOauthAuthority: process.env.AAD_APP_OAUTH_AUTHORITY,
  HR_EMAIL: process.env.HR_EMAIL,
  ADMIN_GROUP: process.env.ADMIN_GROUP,
};

export default config;
