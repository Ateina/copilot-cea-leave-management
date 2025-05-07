import { Client } from "@microsoft/microsoft-graph-client";
import { setUserData, getUserData } from "./actions";
import { ApplicationTurnState } from "./app";
import { VacationRequestFilter } from "./models";
import { TurnContext } from "botbuilder";

export async function getGraphClientFromToken(ssoToken: string): Promise<Client> {
  const graphClient = Client.init({
    authProvider: (done) => {
      done(null, ssoToken);
    }
  });
  return graphClient;
}

export async function getUserDisplayName(state, token: string): Promise<string | undefined> {
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

export async function fetchVacationListItems(graphClient: Client, userEmail: string): Promise<any[] | undefined> {
  let listItems: any | undefined;
  const siteId = "15c4a3c2-e253-40d6-aab6-e2e28274eb90";
  const listId = "68608cf3-c7cd-4f04-9467-b18dfd952805";
  try {

    listItems = await graphClient
        .api(`/sites/${siteId}/lists/${listId}/items`)
        .expand("fields")
        .filter(`fields/UserEmail eq '${userEmail}'`)
        .get();
  } catch (error) {
    console.log(`Error calling Graph SDK in fetchVacationListItems: ${error}`);
  }

  return listItems.value;
}

export async function listCurrentUserVacationRequests(context: TurnContext, state: ApplicationTurnState, { userEmail }: VacationRequestFilter  ): Promise<void> {
    const ssoToken = state.temp.authTokens?.graph;
    if (!ssoToken) {
      await context.sendActivity("Please sign in to view your vacation requests.");
    }
  
    try {
      const client = await getGraphClientFromToken(ssoToken);
      const userData = getUserData(state);
      const listItems = await fetchVacationListItems(client, userData.mail);
      if (!listItems.length) {
        await context.sendActivity("No requests were found.");
      } else {
        const summary = listItems.map(i => `• ${i.fields.ApprovalStatus} (${i.fields.LeaveType}) (${i.fields.StartDate}) - (${i.fields.EndDate})`).join("\n");
        
        await context.sendActivity(`Here are your vacation requests:\n\n${summary}`);
      }
    } catch (err) {
      console.error("[ERROR] Failed to fetch vacation requests:", err);
      await context.sendActivity("An error occurred while retrieving vacation data.");
    }
  }