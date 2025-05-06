import { MemoryStorage, TurnContext } from "botbuilder";
import * as path from "path";
import config from "../config";
import fs from 'fs';
import { Client } from "@microsoft/microsoft-graph-client";
// See https://aka.ms/teams-ai-library to learn more about the Teams AI library.
import { Application, ActionPlanner, OpenAIModel, PromptManager, AuthError, TurnState, DefaultConversationState } from "@microsoft/teams-ai";
import { setUserData, getUserData } from "./actions";

// Create AI components
const model = new OpenAIModel({
  azureApiKey: config.azureOpenAIKey,
  azureDefaultDeployment: config.azureOpenAIDeploymentName,
  azureEndpoint: config.azureOpenAIEndpoint,

  useSystemMessages: true,
  logRequests: true,
});
const prompts = new PromptManager({
  promptsFolder: path.join(__dirname, "../prompts"),
});

const planner = new ActionPlanner({
  model,
  prompts,
  defaultPrompt: async () => {
    const template = await prompts.getPrompt("chat");
    template.actions = require('../prompts/chat/actions.json');
    //template.config = require('../prompts/chat/config.json');
    //template.prompt = require('../prompts/chat/skprompt.txt');
    return template;
  }
});

// Define storage and application
const storage = new MemoryStorage();
const app = new Application({
  storage,
  authentication: {settings: {
    graph: {
      scopes: ['User.Read', 'Sites.Read.All'],
      msalConfig: {
        auth: {
          clientId: config.aadAppClientId!,
          clientSecret: config.aadAppClientSecret!,
          authority: `${config.aadAppOauthAuthorityHost}/common`
        }
      },
      signInLink: `https://${config.botDomain}/auth-start.html`,
      endOnInvalidMessage: true
    }
  }},
  ai: {
    planner,
    //feedback loop is enabled
    enable_feedback_loop: true
  },
});

interface ConversationState extends DefaultConversationState  {
  userData: any;
}
export type ApplicationTurnState = TurnState<ConversationState>;
app.authentication.get('graph').onUserSignInSuccess(async (context: TurnContext, state: ApplicationTurnState) => {
  const token = state.temp.authTokens['graph'];
  await context.sendActivity(`Hello ${await getUserDisplayName(state, token)}. You have successfully logged in to Leave Management!`);
});
app.authentication
    .get('graph')
    .onUserSignInFailure(async (context: TurnContext, _state: ApplicationTurnState, error: AuthError) => {
        await context.sendActivity('Failed to login');
        await context.sendActivity(`Error message: ${error.message}`);
    });

    // Listen for user to say '/reset' and then delete conversation state
app.message('/reset', async (context: TurnContext, state: ApplicationTurnState) => {
  state.deleteConversationState();
  await context.sendActivity(`Ok I've deleted the current conversation state.`);
});

app.message('/signout', async (context: TurnContext, state: ApplicationTurnState) => {
  await app.authentication.signOutUser(context, state);

  // Echo back users request
  await context.sendActivity(`You have signed out`);
});

export interface VacationRequestFilter {
  /** If supplied, return only requests created by this e‑mail.  */
  userEmail?: string;
}

app.ai.action(
  "listVacationRequests", 
  async (context, state:ApplicationTurnState, parameters: VacationRequestFilter): Promise<string> => {
    console.log("[DEBUG] listVacationRequests triggered");
    await listVacationRequests(context, state, parameters);
    return "Done!";
  }
);

async function getUserDisplayName(state, token: string): Promise<string | undefined> {
  let displayName: string | undefined;

  const client = await getGraphClientFromToken(token);

  try {
    const user = await client.api('/me').get();
    setUserData(state, user)
    displayName = user.displayName;
  } catch (error) {
    console.log(`Error calling Graph SDK in getUserDisplayName: ${error}`);
  }

  return displayName;
}

async function fetchVacationListItems(graphClient: Client, userEmail: string): Promise<any[] | undefined> {
  let listItems: any | undefined;
  //const siteId = config.siteId;
  const siteId = "15c4a3c2-e253-40d6-aab6-e2e28274eb90";
  const listId = "68608cf3-c7cd-4f04-9467-b18dfd952805";
  try {
    listItems = await graphClient
      .api(`/sites/${siteId}/lists/${listId}/items?expand=fields`)
      .get();
  } catch (error) {
    console.log(`Error calling Graph SDK in fetchVacationListItems: ${error}`);
  }

  return listItems.value;
}

async function listVacationRequests(context: TurnContext, state: ApplicationTurnState, { userEmail }: VacationRequestFilter  ): Promise<void> {
  const ssoToken = state.temp.authTokens?.graph;
  if (!ssoToken) {
    await context.sendActivity("Please sign in to view your vacation requests.");
    return;
  }

  try {
    const client = await getGraphClientFromToken(ssoToken);
const userData = getUserData(state);
    const listItems = await fetchVacationListItems(client, userData.mail);
    console.log(listItems);

    if (!listItems.length) {
      await context.sendActivity("You have no vacation requests.");
    } else {
      const summary = listItems.map(i => `• ${i.fields.ApprovalStatus} (${i.fields.LeaveType}) (${i.fields.StartDate}) - (${i.fields.EndDate})`).join("\n");
      await context.sendActivity(`Here are your vacation requests:\n\n${summary}`);
    }
  } catch (err) {
    console.error("[ERROR] Failed to fetch vacation requests:", err);
    await context.sendActivity("An error occurred while retrieving vacation data.");
  }
}

app.feedbackLoop(async (context, state, feedbackLoopData) => {
  //add custom feedback process logic here
  console.log("Your feedback is " + JSON.stringify(context.activity.value));
});

export async function getGraphClientFromToken(ssoToken: string): Promise<Client> {

  const graphClient = Client.init({
    authProvider: (done) => {
      done(null, ssoToken);
    }
  });

  return graphClient;
}

export default app;
