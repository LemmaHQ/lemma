package com.lemmaos.lemma.data

interface AppContainer {
    val authRepository: AuthRepository
    val conversationRepository: ConversationRepository
    val chatRepository: ChatRepository
    val providerRepository: ProviderRepository
    val storageRepository: StorageRepository

    fun startSync()

    fun stopSync()
}

expect fun createAppContainer(
    serverConfig: ServerConfigStore,
    session: SessionStore,
    userId: String,
): AppContainer
