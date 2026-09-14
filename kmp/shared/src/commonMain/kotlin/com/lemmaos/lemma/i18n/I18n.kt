package com.lemmaos.lemma.i18n

import com.russhwolf.settings.Settings

enum class Language {
    EN,
    ZH,
}

private const val KEY_LANGUAGE = "language"
object I18n {
    var current: Language = load()
        private set

    fun setLanguage(value: Language) {
        current = value
        Settings().putString(KEY_LANGUAGE, value.name)
    }

    private fun load(): Language {
        return when (Settings().getStringOrNull(KEY_LANGUAGE)) {
            Language.ZH.name -> Language.ZH
            else -> Language.EN
        }
    }

    fun t(key: String): String = when (current) {
        Language.EN -> EN[key] ?: key
        Language.ZH -> ZH[key] ?: EN[key] ?: key
    }
}

private val EN = mapOf(
    "serverUrl.title" to "Connect to a server",
    "serverUrl.field" to "Server URL",
    "serverUrl.error" to "Enter a valid http(s) URL",
    "serverUrl.continue" to "Continue",
    "auth.headline" to "Self-hosted AI Chat",
    "auth.subtitle" to "Sign in or create an account to continue.",
    "auth.identifier" to "Username or email",
    "auth.username" to "Username",
    "auth.email" to "Email",
    "auth.password" to "Password",
    "auth.signIn" to "Sign in",
    "auth.signUp" to "Create account",
    "auth.toSignUp" to "Create an account",
    "auth.toSignIn" to "Already have an account? Sign in",
    "conversations.title" to "Conversations",
    "conversations.archivedTitle" to "Archived",
    "conversations.new" to "New conversation",
    "conversations.signOut" to "Sign out",
    "conversations.active" to "Active",
    "conversations.archived" to "Archived",
    "conversations.empty" to "No conversations yet",
    "conversations.select" to "Select a conversation",
    "conversations.rename" to "Rename",
    "conversations.renameTitle" to "Rename conversation",
    "conversations.archive" to "Archive",
    "conversations.restore" to "Restore",
    "conversations.delete" to "Delete permanently",
    "conversations.untitled" to "Untitled",
    "group.today" to "Today",
    "group.yesterday" to "Yesterday",
    "group.last7Days" to "Last 7 days",
    "group.earlier" to "Earlier",
    "chat.message" to "Message",
    "chat.send" to "Send",
    "chat.stop" to "Stop generating",
    "chat.loadMore" to "Load earlier messages",
    "chat.selectModel" to "Select a model",
    "chat.aborted" to "aborted",
    "providers.title" to "Providers",
    "providers.add" to "Add provider",
    "providers.empty" to "No providers configured",
    "providers.edit" to "Edit provider",
    "providers.name" to "Name",
    "providers.baseUrl" to "Base URL",
    "providers.apiKey" to "API key",
    "providers.apiKeyKeep" to "API key (leave blank to keep)",
    "providers.apiPath" to "API path (optional)",
    "providers.modelsPath" to "Models path (optional)",
    "providers.fetchModels" to "Fetch models",
    "providers.models" to "Models (one per line)",
    "providers.save" to "Save",
    "providers.cancel" to "Cancel",
    "providers.delete" to "Delete provider",
    "providers.editProvider" to "Edit provider",
    "storage.title" to "Archive storage",
    "storage.notConfigured" to "Not configured. Archives are stored in place on the server.",
    "storage.endpoint" to "Endpoint",
    "storage.region" to "Region",
    "storage.bucket" to "Bucket (must already exist)",
    "storage.accessKey" to "Access key ID",
    "storage.accessKeyKeep" to "Access key ID (leave blank to keep)",
    "storage.secretKey" to "Secret access key",
    "storage.secretKeyKeep" to "Secret access key (leave blank to keep)",
    "storage.save" to "Save",
    "storage.test" to "Test connection",
    "storage.delete" to "Delete",
    "storage.pending" to "Pending migration",
    "storage.migrate" to "Start migration",
    "storage.deleteTitle" to "Delete storage configuration?",
    "storage.deleteBody" to
        "Archived conversations still referencing this storage will block the deletion. Restore or delete them first.",
)

private val ZH = mapOf(
    "serverUrl.title" to "连接服务器",
    "serverUrl.field" to "服务器地址",
    "serverUrl.error" to "请输入有效的 http(s) 地址",
    "serverUrl.continue" to "继续",
    "auth.headline" to "自托管 AI 对话",
    "auth.subtitle" to "登录或创建账号以继续。",
    "auth.identifier" to "用户名或邮箱",
    "auth.username" to "用户名",
    "auth.email" to "邮箱",
    "auth.password" to "密码",
    "auth.signIn" to "登录",
    "auth.signUp" to "创建账号",
    "auth.toSignUp" to "创建一个账号",
    "auth.toSignIn" to "已有账号？去登录",
    "conversations.title" to "会话",
    "conversations.archivedTitle" to "归档",
    "conversations.new" to "新建会话",
    "conversations.signOut" to "退出登录",
    "conversations.active" to "活跃",
    "conversations.archived" to "归档",
    "conversations.empty" to "还没有会话",
    "conversations.select" to "选择一个会话",
    "conversations.rename" to "重命名",
    "conversations.renameTitle" to "重命名会话",
    "conversations.archive" to "归档",
    "conversations.restore" to "恢复",
    "conversations.delete" to "彻底删除",
    "conversations.untitled" to "未命名",
    "group.today" to "今天",
    "group.yesterday" to "昨天",
    "group.last7Days" to "最近 7 天",
    "group.earlier" to "更早",
    "chat.message" to "输入消息",
    "chat.send" to "发送",
    "chat.stop" to "停止生成",
    "chat.loadMore" to "加载更早的消息",
    "chat.selectModel" to "选择模型",
    "chat.aborted" to "已中止",
    "providers.title" to "模型供应商",
    "providers.add" to "添加供应商",
    "providers.empty" to "尚未配置供应商",
    "providers.edit" to "编辑供应商",
    "providers.name" to "名称",
    "providers.baseUrl" to "Base URL",
    "providers.apiKey" to "API key",
    "providers.apiKeyKeep" to "API key（留空保持不变）",
    "providers.apiPath" to "API 路径（可选）",
    "providers.modelsPath" to "模型路径（可选）",
    "providers.fetchModels" to "拉取模型列表",
    "providers.models" to "模型（每行一个）",
    "providers.save" to "保存",
    "providers.cancel" to "取消",
    "providers.delete" to "删除供应商",
    "providers.editProvider" to "编辑供应商",
    "storage.title" to "归档存储",
    "storage.notConfigured" to "未配置。归档将就地存储在服务器上。",
    "storage.endpoint" to "Endpoint",
    "storage.region" to "Region",
    "storage.bucket" to "桶（须已存在）",
    "storage.accessKey" to "Access Key ID",
    "storage.accessKeyKeep" to "Access Key ID（留空保持不变）",
    "storage.secretKey" to "Secret Access Key",
    "storage.secretKeyKeep" to "Secret Access Key（留空保持不变）",
    "storage.save" to "保存",
    "storage.test" to "测试连接",
    "storage.delete" to "删除",
    "storage.pending" to "待迁移",
    "storage.migrate" to "开始迁移",
    "storage.deleteTitle" to "删除存储配置？",
    "storage.deleteBody" to "仍有归档会话引用此存储时将阻止删除。请先恢复或删除它们。",
)
