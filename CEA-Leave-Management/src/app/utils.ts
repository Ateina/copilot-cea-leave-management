import { Client } from "@microsoft/microsoft-graph-client";
import { CardFactory, TurnContext } from "botbuilder";
import { getIsAdmin, getUserData, setIsAdmin, setUserData } from "./actions";
import { ApplicationTurnState } from "./app";
import { LeaveRequest, LeaveRequestFilter, LeaveRequestUpdate } from "./models";
import config from '../config';
import { getItemCard, getListCard } from "./utils/cardBuilder";
import { Constants } from "./constants";
import { PromptManager } from "@microsoft/teams-ai/lib/prompts/PromptManager";
import * as path from "path";

const siteId = config.SITE_ID;
const listId = config.LIST_ID;

export async function getGraphClientFromToken(ssoToken: string): Promise<Client> {
  const graphClient = Client.init({
    authProvider: (done) => {
      done(null, ssoToken);
    }
  });
  return graphClient;
}

export async function isAdmin(state, token: string): Promise<boolean | undefined> {
    let isAdmin: boolean | undefined;
    const groupId = config.ADMIN_GROUP;
    const userId = getUserData(state).id;
    console.log("userId", userId)
    const client = await getGraphClientFromToken(token);
    try {
        const group = await client
            .api(`/users/${userId}/memberOf`)
            .filter(`id eq '${groupId}'`)
            .get();
        isAdmin = group.value.length > 0;
    } catch (error) {
        console.log(`Error calling Graph SDK in isAdmin: ${error}`);
    }
    return isAdmin;
}

export async function getUserDisplayName(state, token: string): Promise<string | undefined> {
    let displayName: string | undefined;
    const client = await getGraphClientFromToken(token);
    try {
        const user = await client.api('/me').get();
        setUserData(state, user)
        displayName = user.displayName;
        const isUserAdmin = await isAdmin(state, state.temp.authTokens['graph']);
        setIsAdmin(state, isUserAdmin);
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
                Title: "Vacation Request",
                StartDate: params.startDate,
                EndDate:   params.endDate,
                ApprovalStatus: "Pending",
                LeaveType: params.type,
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

export async function updateRequest(graphClient: Client, params: LeaveRequestUpdate): Promise<any | undefined> {
    let updatedItem: any | undefined;
    try {
        console.log("params:", params);
        updatedItem = await graphClient
            .api(`/sites/${siteId}/lists/${listId}/items/${params.requestId}/fields`)
            .patch({"ApprovalStatus": params.status});

    } catch (error) {
        console.log(`Error calling Graph SDK in updateRequest: ${error}`);
    }

    return updatedItem;
}

export async function listRequestsByStatusByUserByType(context: TurnContext, state: ApplicationTurnState, params: LeaveRequestFilter  ): Promise<void> {
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
            const cardPayload = getListCard(
                "List of Requests",
                Constants.ListImageUrl,
                listItems
            );
            await context.sendActivity({
                attachments: [CardFactory.adaptiveCard(cardPayload)]
              });
              return;
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
        console.log("newItem", newItem);
        if (!newItem) {
            await context.sendActivity("Item creation failed.");
        } else {
              const cardPayload = getItemCard(
                "Item created successfully!",
                newItem.fields.LeaveType === "Vacation" ? Constants.VacationImageUrl : Constants.SickLeaveImageUrl,
                newItem
            );
            
              await context.sendActivity({
                attachments: [CardFactory.adaptiveCard(cardPayload)]
              });
              return;
        }
    } catch (err) {
        console.error("[ERROR] Failed to create a request:", err);
        await context.sendActivity("An error occurred while creating a request.");
    }
}

export async function updateUserRequest(context: TurnContext, state: ApplicationTurnState, params: LeaveRequestUpdate  ): Promise<void> {
    const ssoToken = state.temp.authTokens?.graph;
    if (!ssoToken) {
        await context.sendActivity("Please sign in to view your vacation requests.");
    }

    try {
        const client = await getGraphClientFromToken(ssoToken);
        const updatedItem = await updateRequest(client, params);
        if (!updatedItem) {
            await context.sendActivity("Item update failed.");
        } else {
            const cardPayload = getItemCard(
                "Item updated successfully!",
                updatedItem.fields.LeaveType === "Vacation" ? Constants.VacationImageUrl : Constants.SickLeaveImageUrl,
                updatedItem
            );
            
              await context.sendActivity({
                attachments: [CardFactory.adaptiveCard(cardPayload)]
              });
              return;
        }
    } catch (err) {
        console.error("[ERROR] Failed to update a request:", err);
        await context.sendActivity("An error occurred while updating a request.");
    }
}

export async function sendReminderToApprover(state: ApplicationTurnState, token): Promise<string> {
    const email = await createEmailContent(token, state);
    try {
        const client = Client.init({
            authProvider: (done) => {
                done(null, token);
            }
        });
        const sendEmail = await client.api('/me/sendMail').post(JSON.stringify(email));
        if (sendEmail.ok) {
            return email.message.body.content;
        }
        else {
            console.log(`Error ${sendEmail.status} calling Graph in sendToHR: ${sendEmail.statusText}`);
            return 'Error sending email';
        }
    } catch (error) {
        console.error('Error in sendLists:', error);
        throw error;
    }
}

export async function choosePrompt(context, state){
    let template;
    const prompts = new PromptManager({
      promptsFolder: path.join(__dirname, "../prompts"),
    });
    const isAdmin = getIsAdmin(state);
    console.log("IsAdmin", isAdmin);
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

async function createEmailContent(token, state) {
    const profileName = await getUserDisplayName(state, token);
    let emailContent = `${profileName} needs your attention with theirs leave requests.\n\n`;
    const email ={
        "message": {
        "subject": "Request to review leave requests",
        "body": {
            "contentType": "Text",
            "content": `Hello HR Team, \nI hope this email finds you well. \n\n${emailContent} \n\n Best Regards, \n Leave Management Bot`,
        },
        "toRecipients": [
            {
            "emailAddress": {
                "address": `${config.HR_EMAIL}`
            }
            }
        ]
        },
        "saveToSentCandidates": "true"
    };
    return await email;
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

export function dateFormat(dateString: string): string {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { month: 'long', day: '2-digit' };
    return date.toLocaleDateString('en-US', options);
}