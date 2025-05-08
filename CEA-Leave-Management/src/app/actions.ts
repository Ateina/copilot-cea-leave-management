import { ApplicationTurnState } from './app';

function setUserData(state: ApplicationTurnState, userData: any): void {
    state.conversation.userData = userData;
}

function getUserData(state: ApplicationTurnState): any {
    return state.conversation.userData || null;
}

function setType(state: ApplicationTurnState, newType: string): any {
    state.conversation.type = newType;
}

function getType(state: ApplicationTurnState): any {
    return state.conversation.type || null;
}

export { setUserData, getUserData, setType, getType };