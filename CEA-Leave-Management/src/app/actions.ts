import { ApplicationTurnState } from './app';

function setUserData(state: ApplicationTurnState, userData: any): void {
    state.conversation.userData = userData;
}

function getUserData(state: ApplicationTurnState): any {
    return state.conversation.userData || null;
}

function setIsAdmin(state: ApplicationTurnState, value: boolean): any {
    state.conversation.isAdmin = value;
}

function getIsAdmin(state: ApplicationTurnState): any {
    return state.conversation.isAdmin || null;
}

export { setUserData, getUserData, setIsAdmin, getIsAdmin };