import { ApplicationTurnState } from './app';

function setUserData(state: ApplicationTurnState, userData: any): void {
    state.conversation.userData = userData;
}

function getUserData(state: ApplicationTurnState): any {
    return state.conversation.userData || null;
}

export { setUserData, getUserData };