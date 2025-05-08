import { Client } from "@microsoft/microsoft-graph-client";
import { setUserData } from "./actions";
import { ApplicationTurnState } from "./app";
import { LeaveRequest, LeaveRequestFilter } from "./models";
import { TurnContext } from "botbuilder";

const siteId = "15c4a3c2-e253-40d6-aab6-e2e28274eb90";
const listId = "68608cf3-c7cd-4f04-9467-b18dfd952805";

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

export async function fetchVacationListItems(graphClient: Client, filter: string): Promise<any[] | undefined> {
  let listItems: any | undefined;
  try {

    listItems = await graphClient
        .api(`/sites/${siteId}/lists/${listId}/items`)
        .expand("fields")
        .filter(filter)
        .get();
  } catch (error) {
    console.log(`Error calling Graph SDK in fetchVacationListItems: ${error}`);
  }

  return listItems.value;
}

export async function createRequest(graphClient: Client, params: LeaveRequest): Promise<any | undefined> {
    let newItem: any | undefined;
    try {
  
        newItem = {
            fields: {
                Title:     "Vacation Request",
                StartDate: params.startDate,
                EndDate:   params.endDate,
                //ApprovalStatus: "New",
                //LeaveType: params.type,
                UserEmail: params.userEmail
            }
        };
        console.log("Creating new item:", newItem);
        console.log("params:", params);
        const created = await graphClient
            .api(`/sites/${siteId}/lists/${listId}/items`)
            .post(newItem);

    } catch (error) {
      console.log(`Error calling Graph SDK in fetchVacationListItems: ${error}`);
    }
  
    return newItem;
  }

export async function listCurrentUserAllRequests(context: TurnContext, state: ApplicationTurnState, params: LeaveRequestFilter  ): Promise<void> {
    const ssoToken = state.temp.authTokens?.graph;
    if (!ssoToken) {
    await context.sendActivity("Please sign in to view your vacation requests.");
    }

    try {
    const filter = getFilterString(params);
    const client = await getGraphClientFromToken(ssoToken);
    const listItems = await fetchVacationListItems(client, filter);
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

export async function createUserRequest(context: TurnContext, state: ApplicationTurnState, params: LeaveRequest  ): Promise<void> {
    const ssoToken = state.temp.authTokens?.graph;
    if (!ssoToken) {
        await context.sendActivity("Please sign in to view your vacation requests.");
    }

    try {
    const client = await getGraphClientFromToken(ssoToken);
    const newItem = await createRequest(client, params);
    if (!newItem) {
        await context.sendActivity("Item creation failed.");
    } else {
        await context.sendActivity(`Item created successfully`);
    }
    } catch (err) {
    console.error("[ERROR] Failed to create a request:", err);
    await context.sendActivity("An error occurred while creating a request.");
    }
}

function getFilterString(filter: LeaveRequestFilter): string {
    const filters = [];

    if (filter.userEmail) {
        filters.push(`fields/UserEmail eq '${filter.userEmail}'`);
    }
    if (filter.status) {
        filters.push(`fields/ApprovalStatus eq '${filter.status}'`);
    }
    if (filter.type) {
        filters.push(`fields/LeaveType eq '${filter.type}'`);
    }

    return filters.join(" and ");
}