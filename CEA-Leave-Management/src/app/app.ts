import { MemoryStorage, TurnContext } from "botbuilder";
import * as path from "path";
import config from "../config";
// See https://aka.ms/teams-ai-library to learn more about the Teams AI library.
import { Application, ActionPlanner, OpenAIModel, PromptManager, AuthError, TurnState, DefaultConversationState } from "@microsoft/teams-ai";
import { createUserRequest, getUserDisplayName, listRequestsByStatusByUserByType, sendReminderToApprover, isAdmin, updateUserRequest } from "./utils";
import { LeaveRequest, LeaveRequestFilter, LeaveRequestUpdate } from "./models";
import { getUserData, setIsAdmin, getIsAdmin } from "./actions";

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
    let template;
    const isAdmin = true;
    if(isAdmin) {
      template = await prompts.getPrompt("admin");
      template.actions = require('../prompts/admin/actions.json');
      return template;
    }
    else {
      template = await prompts.getPrompt("chat");
      template.actions = require('../prompts/chat/actions.json');
      return template;
    }
    
  }
});

const storage = new MemoryStorage();
const app = new Application({
  storage,
  authentication: {settings: {
    graph: {
      scopes: ['User.Read', 'Sites.ReadWrite.All', 'Mail.Send', 'Group.Read.All'],
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
    enable_feedback_loop: true
  },
});

interface ConversationState extends DefaultConversationState  {
  userData: any;
  isAdmin?: boolean;
}
export type ApplicationTurnState = TurnState<ConversationState>;
app.authentication.get('graph').onUserSignInSuccess(async (context: TurnContext, state: ApplicationTurnState) => {
  console.log("[DEBUG] onUserSignInSuccess triggered");
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
  await context.sendActivity(`You have signed out`);
});

//USER ACTIONS
app.ai.action(
  "getRequestsByQueryForCurrentUser",
  async (context, state:ApplicationTurnState, parameters: LeaveRequestFilter) => {
    console.log("[DEBUG] listRequestsByStatusByUserByType triggered");
    parameters.userEmail = getUserData(state).mail;
    await listRequestsByStatusByUserByType(context, state, parameters);
    return "Ask if user wants to create a new vacation request";
  }
);

app.ai.action(
  "createRequestForCurrentUser",
  async (context, state:ApplicationTurnState, parameters: LeaveRequest) => {
    console.log("[DEBUG] createRequestForCurrentUser triggered");
    parameters.userEmail = getUserData(state).mail;
    await createUserRequest(context, state, parameters);
    return "Ask if user wants to see list of their requests";
  }
);

app.ai.action('sendReminderToApprover', async (context: TurnContext, state: ApplicationTurnState, parameters: LeaveRequest) => {
  await sendReminderToApprover(state, state.temp.authTokens['graph']);
  return `Email sent to HR. Summarize your action.`;
});

// ADMIN ACTIONS
app.ai.action('getRequestsByQuery', async (context: TurnContext, state: ApplicationTurnState, parameters: LeaveRequestFilter) => {
  await listRequestsByStatusByUserByType(context, state, parameters);
  return `Ask if admin wants to approve or reject a request`;
});

app.ai.action('approveRejectRequest', async (context: TurnContext, state: ApplicationTurnState, parameters: LeaveRequestUpdate) => {
  await updateUserRequest(context, state, parameters);
  return `Ask if admin wants to approve or reject another request`;
});

app.feedbackLoop(async (context, state, feedbackLoopData) => {
  //add custom feedback process logic here
  console.log("Your feedback is " + JSON.stringify(context.activity.value));
});

export default app;
