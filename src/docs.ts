/**
 * Jibot Documentation
 * 
 * Full documentation for all Jibot features and commands.
 */

export const DOCS = {
  overview: `*Jibot - Workspace Memory & Assistant*

Jibot learns about people in your workspace, captures reminders, tracks mentions, and helps with lookups. Think of it as a shared team memory that grows smarter over time.

*Core Concepts:*
• *Facts* — Things Jibot learns about people ("@alice is the CTO")
• *Inbox* — Reminders sent to the workspace owner
• *Mentions* — Automatic tracking when the owner is @mentioned
• *Permissions* — Three tiers: Owner, Admin, Guest

Use \`/jibot docs [topic]\` for detailed help on any topic.
Topics: people, inbox, mentions, calendar, permissions, commands, linking`,

  people: `*📚 People & Facts*

Jibot learns facts about people and recalls them on request.

*Teaching Facts:*
\`\`\`
jibot @alice is the head of design
jibot @bob is based in Tokyo and speaks Japanese
jibot @carol is working on Project Atlas
\`\`\`

*Recalling Facts:*
\`\`\`
who is @alice?
jibot who is @bob
\`\`\`
Jibot combines all known facts into a natural sentence.

*Forgetting Facts:*
\`\`\`
jibot forget @alice          → Lists all facts with numbers
jibot forget @alice 2        → Forgets fact #2
jibot forget @alice all      → Forgets everything about @alice
\`\`\`

*Channel Welcomes:*
When someone joins a channel, Jibot welcomes them with what it knows:
"👋 Welcome Alice! (head of design, working on Project Atlas)"

*Per-Workspace Storage:*
Facts are stored separately for each workspace. Use \`/jibot linkuser\` to connect the same person across workspaces.`,

  inbox: `*📥 Inbox & Reminders*

Anyone can send reminders to the workspace owner. Reminders sync to Apple Reminders for persistence.

*Sending Reminders:*
\`\`\`
remind joi to review the proposal
remind joi to call back the investor
@jibot remind joi to check the budget
\`\`\`

The bot confirms publicly so the sender knows it went through:
"📥 Got it! I'll remind Joi to: *review the proposal*"

*Managing Inbox (Owner Only):*
\`\`\`
/jibot inbox              → View all pending reminders
/jibot clear 3            → Clear reminder #3
/jibot clear all          → Clear entire inbox
\`\`\`

*Apple Reminders Integration:*
• Reminders sync to the "Jibot" list in Apple Reminders
• Complete them in Apple Reminders or via \`/jibot clear\`
• Changes sync both directions`,

  mentions: `*📢 Mention Tracking*

Jibot monitors all channels for @mentions of the owner and creates reminders automatically.

*How It Works:*
1. Someone mentions @owner in any channel
2. Jibot captures the full message
3. Non-English messages are translated automatically
4. A reminder is created with:
   • The message (translated if needed)
   • Who said it
   • Which channel
   • Clickable link to the original message

*Where Mentions Go:*
• Stored in "Slack Mentions" list in Apple Reminders
• Separate from the regular Jibot inbox
• Includes original text for translated messages

*Supported Languages:*
Japanese, Chinese, Korean, Russian, Arabic (auto-detected and translated)

*Note:* Jibot only tracks mentions by others, not self-mentions.`,

  calendar: `*📅 Calendar Integration*

Admins can add events to the owner's calendar using natural language.

*Adding Events:*
\`\`\`
/jibot calendar meeting with design team tomorrow at 2pm
/jibot calendar lunch with @alice on Friday at noon
/jibot calendar Project review next Monday 10am-11am
\`\`\`

*Natural Language Support:*
• Relative dates: "tomorrow", "next Tuesday", "in 3 days"
• Times: "2pm", "14:00", "noon", "morning"
• Durations: "10am-11am", "for 2 hours"
• Attendees: Include @mentions to add people

*Permissions:*
Only admins and the owner can add calendar events. Guests receive an error message.

*Integration:*
Events are added to Apple Calendar on the owner's machine.`,

  permissions: `*🔐 Permission System*

Jibot has three permission tiers with different access levels.

*👑 Owner*
• Full access to all features
• View and manage inbox
• Add calendar events
• Promote/demote admins
• Link identities across workspaces
• Set by: \`/jibot setowner\` (first-time only)

*⭐ Admin*
• View inbox (read-only)
• Add calendar events
• Link user identities
• All guest permissions
• Promoted by: \`/jibot admin @user\`

*👤 Guest (Everyone Else)*
• Teach and recall facts about people
• Send reminders to owner
• Use explain and lookup commands
• Ask questions

*Managing Permissions:*
\`\`\`
/jibot admin @user        → Promote to admin
/jibot demote @user       → Demote to guest
/jibot admins             → List all admins
\`\`\`

*Cross-Workspace Identity:*
\`\`\`
/jibot link @user UID     → Link admin/owner ID across workspaces
\`\`\`
This lets the same person have admin access in multiple workspaces.`,

  commands: `*💡 All Commands*

*In-Channel Commands (everyone):*
\`\`\`
jibot @user is [fact]        → Teach a fact
who is @user?                → Recall facts
jibot forget @user           → List facts to forget
jibot forget @user [n]       → Forget fact #n
jibot forget @user all       → Forget all facts
remind joi to [message]      → Send reminder
explain [topic]              → Look up concept
what is [organization]       → Look up organization
jibot help                   → Show help
\`\`\`

*Slash Commands:*
\`\`\`
/jibot help                  → Show help
/jibot docs [topic]          → Show documentation
/jibot inbox                 → View inbox (owner)
/jibot clear [n|all]         → Clear reminders (owner)
/jibot calendar [event]      → Add calendar event (admin+)
/jibot admin @user           → Promote to admin (owner)
/jibot demote @user          → Demote to guest (owner)
/jibot admins                → List admins (admin+)
/jibot link @user UID        → Link admin identity (owner)
/jibot linkuser @user T:U    → Link person across workspaces (admin+)
/jibot setowner              → Claim ownership (first-time)
\`\`\`

*DM Commands:*
Message Jibot directly with any command. Useful for private inbox management.`,

  linking: `*🔗 Cross-Workspace Linking*

Jibot can run in multiple Slack workspaces. Linking connects identities across them.

*Why Link?*
• Same person, different Slack accounts in different workspaces
• Share facts about a person across workspaces
• Maintain admin permissions across workspaces

*Linking People (for facts):*
\`\`\`
/jibot linkuser @alice T05ABC123:U05XYZ789
\`\`\`
Format: \`/jibot linkuser @localuser TEAM_ID:USER_ID\`

After linking, "who is @alice?" shows facts from all linked workspaces.

*Linking Admins/Owner (for permissions):*
\`\`\`
/jibot link @admin U05XYZ789
\`\`\`
This lets an admin use their permissions in another workspace.

*Finding IDs:*
• *Team ID:* Workspace settings → "Workspace ID"
• *User ID:* Click profile → ⋮ → "Copy member ID"

*Example Workflow:*
1. You're owner in Workspace A (your ID: U02ABC)
2. You join Workspace B (your ID: U05XYZ)
3. In Workspace A: \`/jibot link @you U05XYZ\`
4. Now you're owner in both workspaces`,

  quickstart: `*🚀 Quick Start Guide*

*First-Time Setup (Owner):*
1. Run \`/jibot setowner\` to claim ownership
2. Grant Reminders permission if prompted
3. Done! You're the owner.

*Basic Usage:*
\`\`\`
jibot @alice is the CTO           → Teach a fact
who is @alice?                    → Recall facts
remind joi to review docs         → Send reminder
/jibot inbox                      → Check inbox
\`\`\`

*For Admins:*
Ask the owner to run \`/jibot admin @you\`

*Multi-Workspace:*
1. Create another Slack app for the new workspace
2. Use the same Jibot code with different credentials
3. Link your identity: \`/jibot link @you OTHER_UID\`

*Get Help:*
\`\`\`
/jibot help              → Quick command reference
/jibot docs              → Full documentation
/jibot docs [topic]      → Specific topic
\`\`\``
};

export function getDocs(topic?: string): string {
  if (!topic || topic === "full" || topic === "all") {
    return DOCS.overview;
  }
  
  const key = topic.toLowerCase().replace(/[^a-z]/g, "");
  
  // Map common variations
  const topicMap: Record<string, keyof typeof DOCS> = {
    "people": "people",
    "facts": "people",
    "learn": "people",
    "whois": "people",
    "inbox": "inbox",
    "remind": "inbox",
    "reminders": "inbox",
    "reminder": "inbox",
    "mentions": "mentions",
    "mention": "mentions",
    "tracking": "mentions",
    "calendar": "calendar",
    "cal": "calendar",
    "events": "calendar",
    "event": "calendar",
    "permissions": "permissions",
    "permission": "permissions",
    "perms": "permissions",
    "admin": "permissions",
    "admins": "permissions",
    "owner": "permissions",
    "commands": "commands",
    "command": "commands",
    "cmd": "commands",
    "cmds": "commands",
    "help": "commands",
    "linking": "linking",
    "link": "linking",
    "crossworkspace": "linking",
    "multiworkspace": "linking",
    "workspace": "linking",
    "quickstart": "quickstart",
    "start": "quickstart",
    "setup": "quickstart",
    "getting": "quickstart",
    "gettingstarted": "quickstart",
    "overview": "overview",
  };
  
  const mappedTopic = topicMap[key];
  if (mappedTopic && DOCS[mappedTopic]) {
    return DOCS[mappedTopic];
  }
  
  return `Unknown topic: "${topic}"\n\nAvailable topics: people, inbox, mentions, calendar, permissions, commands, linking, quickstart`;
}

export function getDocsTopics(): string[] {
  return ["overview", "people", "inbox", "mentions", "calendar", "permissions", "commands", "linking", "quickstart"];
}

// Japanese Documentation
export const DOCS_JA = {
  overview: `*Jibot - ワークスペースの記憶とアシスタント*

Jibotはワークスペースの人々について学習し、リマインダーを管理し、メンションを追跡し、検索を手伝うボットです。チーム全体で共有される記憶として、時間とともに賢くなっていきます。

*基本概念:*
• *ファクト* — Jibotが人について学ぶこと（「@aliceはCTOです」）
• *インボックス* — ワークスペースオーナーへのリマインダー
• *メンション* — オーナーが@メンションされた時の自動追跡
• *権限* — 3つのレベル：オーナー、管理者、ゲスト

\`/jibot docs ja [トピック]\` で詳細なヘルプを表示
トピック: people, inbox, mentions, calendar, permissions, commands, linking`,

  people: `*📚 人物とファクト*

Jibotは人々についてのファクトを学習し、リクエストに応じて思い出します。

*ファクトを教える:*
\`\`\`
jibot @alice is the head of design
jibot @bob is based in Tokyo and speaks Japanese
jibot @carol is working on Project Atlas
\`\`\`

*ファクトを思い出す:*
\`\`\`
who is @alice?
jibot who is @bob
\`\`\`
Jibotは知っているファクトを自然な文章にまとめて返答します。

*ファクトを忘れる:*
\`\`\`
jibot forget @alice          → ファクト一覧を番号付きで表示
jibot forget @alice 2        → ファクト#2を削除
jibot forget @alice all      → @aliceについて全て忘れる
\`\`\`

*チャンネル参加時の挨拶:*
誰かがチャンネルに参加すると、Jibotは知っている情報で歓迎します：
「👋 Aliceさん、ようこそ！（デザイン責任者、Project Atlas担当）」

*ワークスペース別の保存:*
ファクトはワークスペースごとに別々に保存されます。\`/jibot linkuser\`で異なるワークスペースの同一人物を紐づけできます。`,

  inbox: `*📥 インボックスとリマインダー*

誰でもワークスペースオーナーにリマインダーを送れます。リマインダーはAppleリマインダーに同期されます。

*リマインダーを送る:*
\`\`\`
remind joi to review the proposal
remind joi to call back the investor
@jibot remind joi to check the budget
\`\`\`

ボットは公開で確認メッセージを送信します：
「📥 了解！Joiにリマインド：*提案書をレビュー*」

*インボックスの管理（オーナーのみ）:*
\`\`\`
/jibot inbox              → 保留中のリマインダーを表示
/jibot clear 3            → リマインダー#3をクリア
/jibot clear all          → インボックスを全てクリア
\`\`\`

*Appleリマインダー連携:*
• リマインダーは「Jibot」リストに同期
• Appleリマインダーまたは\`/jibot clear\`で完了
• 変更は双方向で同期`,

  mentions: `*📢 メンション追跡*

Jibotは全チャンネルでオーナーへの@メンションを監視し、自動的にリマインダーを作成します。

*仕組み:*
1. 誰かがチャンネルで@オーナーをメンション
2. Jibotがメッセージ全体をキャプチャ
3. 日本語以外のメッセージは自動翻訳
4. リマインダーが作成され、以下を含む：
   • メッセージ（必要に応じて翻訳）
   • 発言者
   • チャンネル
   • 元のメッセージへのリンク

*メンションの保存先:*
• Appleリマインダーの「Slack Mentions」リストに保存
• 通常のJibotインボックスとは別
• 翻訳されたメッセージには原文も含まれる

*対応言語:*
日本語、中国語、韓国語、ロシア語、アラビア語（自動検出・翻訳）

*注意:* 自分自身のメンションは追跡されません。`,

  calendar: `*📅 カレンダー連携*

管理者はオーナーのカレンダーに自然言語でイベントを追加できます。

*イベントの追加:*
\`\`\`
/jibot calendar meeting with design team tomorrow at 2pm
/jibot calendar lunch with @alice on Friday at noon
/jibot calendar Project review next Monday 10am-11am
\`\`\`

*自然言語サポート:*
• 相対日付：「tomorrow」「next Tuesday」「in 3 days」
• 時間：「2pm」「14:00」「noon」「morning」
• 期間：「10am-11am」「for 2 hours」
• 参加者：@メンションで追加

*権限:*
管理者とオーナーのみカレンダーイベントを追加可能。

*連携:*
イベントはオーナーのマシンのAppleカレンダーに追加されます。`,

  permissions: `*🔐 権限システム*

Jibotには3つの権限レベルがあります。

*👑 オーナー*
• 全機能へのフルアクセス
• インボックスの表示・管理
• カレンダーイベントの追加
• 管理者の昇格・降格
• ワークスペース間のID紐づけ
• 設定方法：\`/jibot setowner\`（初回のみ）

*⭐ 管理者*
• インボックスの表示（読み取り専用）
• カレンダーイベントの追加
• ユーザーIDの紐づけ
• ゲストの全権限
• 昇格方法：\`/jibot admin @user\`

*👤 ゲスト（その他全員）*
• ファクトの教示・確認
• オーナーへのリマインダー送信
• 説明・検索コマンドの使用
• 質問

*権限の管理:*
\`\`\`
/jibot admin @user        → 管理者に昇格
/jibot demote @user       → ゲストに降格
/jibot admins             → 管理者一覧を表示
\`\`\`

*ワークスペース間のID連携:*
\`\`\`
/jibot link @user UID     → 管理者/オーナーIDを別ワークスペースと紐づけ
\`\`\``,

  commands: `*💡 全コマンド一覧*

*チャンネルコマンド（全員）:*
\`\`\`
jibot @user is [fact]        → ファクトを教える
who is @user?                → ファクトを確認
jibot forget @user           → 忘れるファクトを一覧表示
jibot forget @user [n]       → ファクト#nを削除
jibot forget @user all       → 全ファクトを削除
remind joi to [message]      → リマインダーを送る
explain [topic]              → 概念を検索
what is [organization]       → 組織を検索
jibot help                   → ヘルプを表示
\`\`\`

*スラッシュコマンド:*
\`\`\`
/jibot help                  → ヘルプを表示
/jibot docs [topic]          → ドキュメントを表示
/jibot docs ja [topic]       → 日本語ドキュメント
/jibot inbox                 → インボックス表示（オーナー）
/jibot clear [n|all]         → リマインダーをクリア（オーナー）
/jibot calendar [event]      → カレンダー追加（管理者+）
/jibot admin @user           → 管理者に昇格（オーナー）
/jibot demote @user          → 降格（オーナー）
/jibot admins                → 管理者一覧（管理者+）
/jibot link @user UID        → 管理者ID紐づけ（オーナー）
/jibot linkuser @user T:U    → ユーザー紐づけ（管理者+）
/jibot setowner              → オーナー設定（初回）
\`\`\`

*DMコマンド:*
Jibotに直接メッセージで任意のコマンドを送信可能。プライベートなインボックス管理に便利。`,

  linking: `*🔗 ワークスペース間の紐づけ*

Jibotは複数のSlackワークスペースで動作可能。紐づけにより異なるワークスペース間でIDを接続します。

*なぜ紐づけが必要？*
• 同じ人が異なるワークスペースで別のSlackアカウントを持つ場合
• ワークスペース間でファクトを共有
• 複数ワークスペースで管理者権限を維持

*ユーザーの紐づけ（ファクト用）:*
\`\`\`
/jibot linkuser @alice T05ABC123:U05XYZ789
\`\`\`
形式：\`/jibot linkuser @ローカルユーザー チームID:ユーザーID\`

紐づけ後、「who is @alice?」で全紐づけワークスペースのファクトを表示。

*管理者/オーナーの紐づけ（権限用）:*
\`\`\`
/jibot link @admin U05XYZ789
\`\`\`
これにより管理者が別ワークスペースでも権限を使用可能に。

*IDの確認方法:*
• *チームID:* ワークスペース設定 → 「Workspace ID」
• *ユーザーID:* プロフィール → ⋮ → 「メンバーIDをコピー」

*ワークフロー例:*
1. ワークスペースAでオーナー（ID: U02ABC）
2. ワークスペースBに参加（ID: U05XYZ）
3. ワークスペースAで：\`/jibot link @you U05XYZ\`
4. これで両ワークスペースでオーナー権限を持つ`,

  quickstart: `*🚀 クイックスタートガイド*

*初期設定（オーナー）:*
1. \`/jibot setowner\`を実行してオーナー権限を取得
2. リマインダーの許可を求められたら許可
3. 完了！あなたがオーナーです。

*基本的な使い方:*
\`\`\`
jibot @alice is the CTO           → ファクトを教える
who is @alice?                    → ファクトを確認
remind joi to review docs         → リマインダーを送る
/jibot inbox                      → インボックスを確認
\`\`\`

*管理者になるには:*
オーナーに\`/jibot admin @you\`を実行してもらう

*複数ワークスペース:*
1. 新しいワークスペース用に別のSlackアプリを作成
2. 同じJibotコードを異なる認証情報で使用
3. IDを紐づけ：\`/jibot link @you OTHER_UID\`

*ヘルプ:*
\`\`\`
/jibot help              → クイックコマンドリファレンス
/jibot docs              → 完全なドキュメント
/jibot docs ja           → 日本語ドキュメント
/jibot docs ja [topic]   → 特定のトピック（日本語）
\`\`\``
};

export function getDocsJa(topic?: string): string {
  if (!topic || topic === "full" || topic === "all") {
    return DOCS_JA.overview;
  }
  
  const key = topic.toLowerCase().replace(/[^a-z]/g, "");
  
  const topicMap: Record<string, keyof typeof DOCS_JA> = {
    "people": "people",
    "facts": "people",
    "learn": "people",
    "whois": "people",
    "inbox": "inbox",
    "remind": "inbox",
    "reminders": "inbox",
    "reminder": "inbox",
    "mentions": "mentions",
    "mention": "mentions",
    "tracking": "mentions",
    "calendar": "calendar",
    "cal": "calendar",
    "events": "calendar",
    "event": "calendar",
    "permissions": "permissions",
    "permission": "permissions",
    "perms": "permissions",
    "admin": "permissions",
    "admins": "permissions",
    "owner": "permissions",
    "commands": "commands",
    "command": "commands",
    "cmd": "commands",
    "cmds": "commands",
    "help": "commands",
    "linking": "linking",
    "link": "linking",
    "crossworkspace": "linking",
    "multiworkspace": "linking",
    "workspace": "linking",
    "quickstart": "quickstart",
    "start": "quickstart",
    "setup": "quickstart",
    "getting": "quickstart",
    "gettingstarted": "quickstart",
    "overview": "overview",
  };
  
  const mappedTopic = topicMap[key];
  if (mappedTopic && DOCS_JA[mappedTopic]) {
    return DOCS_JA[mappedTopic];
  }
  
  return `不明なトピック: "${topic}"\n\n利用可能なトピック: people, inbox, mentions, calendar, permissions, commands, linking, quickstart`;
}
