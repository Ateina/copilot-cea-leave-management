import { dateFormat } from "../utils";

export function getListCard(label: string, imageUrl: string, listItems: any[]): any {
    const listItemsContent = listItems.map(item => ({
        type: "TextBlock",
        text: `${item.fields.ApprovalStatus} • ${item.fields.LeaveType} • ${dateFormat(item.fields.StartDate)} - ${dateFormat(item.fields.EndDate)}`,
      }))
    return {
        type: "AdaptiveCard",
        version: "1.4",
        body: [
            { 
                "type": "Container",
                "bleed": true,
                "items": [
                    {
                        "type": "TextBlock",
                        "text": label,
                        "wrap": true,
                        "spacing": "Medium",
                        "size": "Large",
                        "weight": "Bolder",
                        "style": "heading",
                        "color": "Accent"
                    },
                    {
                        "type": "Image",
                        "url": imageUrl,
                        "size": "Stretch",
                        "style": "RoundedCorners"
                    },
                    ...listItemsContent
                ]
            }
        ]
    };
}

export function getItemCard(label: string, imageUrl: string, item: any): any {
    return {
        type: "AdaptiveCard",
        version: "1.4",
        body: [
            { 
                "type": "Container",
                "bleed": true,
                "items": [
                    {
                        "type": "TextBlock",
                        "text": label,
                        "wrap": true,
                        "spacing": "Medium",
                        "size": "Large",
                        "weight": "Bolder",
                        "style": "heading",
                        "color": "Accent"
                    },
                    {
                        "type": "Image",
                        "url": imageUrl,
                        "size": "Stretch",
                        "style": "RoundedCorners"
                    },
                    {
                        type: "TextBlock",
                        text: `Status: ${item.fields.ApprovalStatus}`,
                      },
                      {
                        type: "TextBlock",
                        text: `Type: ${item.fields.LeaveType}`,
                      },
                      {
                        type: "TextBlock",
                        text: `Dates: ${dateFormat(item.fields.StartDate)} - ${dateFormat(item.fields.EndDate)}`,
                      }
                ]
            }
        ]
    };
}