# MARS AI Agent 架构文档

> 面向开发者的完整架构学习指南，覆盖核心设计、数据流、组件详解和扩展方法。

---

## 目录

1. [设计哲学](#1-设计哲学)
2. [总体架构](#2-总体架构)
3. [核心类型系统](#3-核心类型系统)
4. [ConversationRuntime 详解](#4-conversationruntime-详解)
5. [ApiClient — LLM 交互层](#5-apiclient--llm-交互层)
6. [回调机制](#6-回调机制)
7. [Memory 持久化模型](#7-memory-持久化模型)
8. [工具系统](#8-工具系统)
9. [权限控制](#9-权限控制)
10. [UsageTracker 与 SessionCompactor](#10-usagetracker-与-sessioncompactor)
11. [SystemPromptBuilder](#11-systempromptbuilder)
12. [CLI 执行路径](#12-cli-执行路径)
13. [GUI 执行路径](#13-gui-执行路径)
14. [会话加载与上下文继承](#14-会话加载与上下文继承)
15. [添加新工具的完整流程](#15-添加新工具的完整流程)

---

## 1. 设计哲学

### 核心理念

```
用户输入 → ConversationRuntime.run_turn() → 回调 → 显示/持久化
                ↑
        ApiClient (LLM) + 工具执行器
```

- **单次调用完成一轮**：`run_turn()` 内部循环，think→execute→reflect，直到 talk/finish 或达到最大迭代次数
- **回调解耦**：显示 (`on_text`/`on_tool`)、持久化 (`on_save`)、工具执行 三者完全分离
- **类型安全**：所有消息传递使用 dataclass（`ConversationMessage`、`TextBlock`、`ToolUse` 等）
- **不可变历史**：`runtime.messages` 只追加不修改，完整记录所有交互

### 与旧架构的区别

| | 旧架构 (ChatAgent) | 新架构 (ConversationRuntime) |
|------|------|------|
| 控制循环 | `think()` → `execute()` → `reflect()` 三步法 | `run_turn()` 单次调用，内部迭代 |
| 消息模型 | `dict` 混杂格式 | `ConversationMessage` + `ContentBlock` |
| LLM 调用 | `ModelManager.llm_json` + `call_model` | `ApiClient.stream()` 返回 blocks+usage |
| 提示词 | 静态模板 `THINK_PROMPT` / `REFLECT_PROMPT` | `SystemPromptBuilder` 动态构建 |
| 持久化耦合 | `ChatAgent.step()` 内直接调用 `history.add_conversation` | 通过 `on_save` 回调完全解耦 |
| 工具注册 | `TOOL_REGISTRY` 三重元组 | `TOOL_DEFINITIONS` (JSON Schema) + `TOOL_FUNCTIONS` 分离 |
| CLI | 使用 `ChatAgent` | 使用 `ConversationRuntime` |
| GUI | `ChatWorker` 包装 `ChatAgent` | `ChatWorker` 包装 `ConversationRuntime` |

---

## 2. 总体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                           QML 前端                                │
│  main.qml → ChatPage / ToolsPage / SettingsPage                  │
│  Connections { target: chatBridge; onMessageReceived; ... }      │
└───────────────────────────┬──────────────────────────────────────┘
                            │ Qt Signals (QObject::Signal)
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  ChatBridge (QObject, 主线程)                                     │
│  sendMessage(text) → ChatWorker → start()                        │
│  loadSession(filename) → Memory.load_session → _rebuild_chat()  │
│  Signals: messageReceived, toolCalled, sessionListUpdated, ...   │
│  Slots: sendMessage, loadSession, deleteSession, switchModel ... │
└───────────────────────────┬──────────────────────────────────────┘
                            │ ChatWorker(text, api_client, memory)
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  ChatWorker (QThread, 子线程)                                     │
│  run():                                                          │
│    runtime = ConversationRuntime(system_prompt, ...)              │
│    runtime.messages = memory_to_runtime_messages(memory.history) │
│    runtime.run_turn(user_input, client, executor,                │
│                     on_text, on_tool, on_save)                   │
└───────────────────────────┬──────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  ApiClient    │ │  ToolExecutor  │ │  Memory       │
│  stream()     │ │  execute()     │ │  add_message() │
│  _call_cloud  │ │  → call_tool() │ │  add_conver.. │
│  _parse_resp  │ │                │ │  save()→JSON  │
└───────────────┘ └───────────────┘ └───────────────┘
```

### 线程模型

```
主线程 (QML Event Loop)
  ├── ChatBridge (QObject, 所有 Slot 在此执行)
  ├── QML 界面渲染
  └── 不允许阻塞操作

子线程 (QThread)
  └── ChatWorker.run()
      ├── ConversationRuntime.run_turn() (循环 + LLM 调用)
      ├── 工具执行 (shell, web_search 等)
      └── 通过 Qt Signal 向主线程发射结果
          (textChunk, toolInvoked, finished, errorHappened)

Signal 连接类型:
  - 默认 AutoConnection → 跨线程时为 QueuedConnection
  - 即主线程接收到信号时入队，在事件循环中安全处理
```

---

## 3. 核心类型系统

所有类型定义在 `core/runtime/types.py`，使用 `@dataclass` 确保不可变性和类型清晰。

### 3.1 消息角色

```python
class MessageRole(str, Enum):
    SYSTEM = "system"      # 系统提示
    USER = "user"          # 用户输入
    ASSISTANT = "assistant" # LLM 响应
    TOOL = "tool"          # 工具执行结果
```

### 3.2 内容块

```python
ContentBlock = TextBlock | ToolUse | ToolResult

@dataclass
class TextBlock:
    text: str                           # 纯文本内容
    # 用于: talk/finish 消息, 用户消息

@dataclass
class ToolUse:
    id: str                             # 唯一标识, 如 "tu_<hash>"
    name: str                           # 工具名, 如 "shell"
    input: Dict[str, Any]               # 工具参数

@dataclass
class ToolResult:
    tool_use_id: str                    # 对应 ToolUse.id
    content: str                        # 工具执行输出
    is_error: bool = False              # 是否执行失败
```

### 3.3 ConversationMessage

```python
@dataclass
class ConversationMessage:
    role: MessageRole                   # 角色
    blocks: List[ContentBlock]          # 内容块列表
    usage: Optional[TokenUsage] = None  # token 统计

    # 工厂方法
    @staticmethod
    def user_text(text: str) -> 'ConversationMessage':
        # 创建 USER 消息, 含一个 TextBlock

    @staticmethod
    def assistant(blocks, usage=None) -> 'ConversationMessage':
        # 创建 ASSISTANT 消息, 接收 blocks 列表

    @staticmethod
    def tool_result(tool_use_id, content, is_error=False):
        # 创建 TOOL 消息, 含一个 ToolResult
```

**消息结构示例**：

```python
# 用户消息
ConversationMessage.user_text("查b站热点")
# → role=USER, blocks=[TextBlock("查b站热点")]

# LLM 返回 shell 命令
ConversationMessage.assistant([
    ToolUse(id="tu_123", name="shell", input={"command": "dir"})
])
# → role=ASSISTANT, blocks=[ToolUse(...)]

# 工具执行结果
ConversationMessage.tool_result("tu_123", "file1.txt\nfile2.txt", False)
# → role=TOOL, blocks=[ToolResult(tool_use_id="tu_123", content="file1.txt\nfile2.txt", is_error=False)]

# LLM 回复 talk
ConversationMessage.assistant([
    TextBlock(text="B站今日热点: ...")
])
# → role=ASSISTANT, blocks=[TextBlock("B站今日热点: ...")]
```

### 3.4 TokenUsage

```python
@dataclass
class TokenUsage:
    input_tokens: int = 0
    output_tokens: int = 0
    # 支持 + 运算符累加
    def __add__(self, other): ...
```

### 3.5 ApiRequest

```python
@dataclass
class ApiRequest:
    model: str                          # 模型标识, 如 "deepseek-v4-flash"
    messages: List[ConversationMessage]  # 对话历史
    system: str = ""                    # 系统提示词
    max_tokens: int = 4096             # 最大输出 token
    tools: List[ToolDefinition] = []   # 工具定义列表
```

### 3.6 TurnSummary

```python
@dataclass
class TurnSummary:
    assistant_messages: List[ConversationMessage]
    usage: TokenUsage
    iterations: int        # 实际迭代次数
    finished: bool         # 是否正常完成
```

---

## 4. ConversationRuntime 详解

`core/runtime/conversation.py` — 架构核心，控制 LLM 对话循环。

### 4.1 数据字段

```python
@dataclass
class ConversationRuntime:
    messages: List[ConversationMessage]  # 完整对话历史
    system_prompt: str                   # 系统提示词
    max_iterations: int = 100           # 最大迭代次数
    usage_tracker: UsageTracker         # token 追踪
    permission_policy: PermissionPolicy  # 权限策略
    compactor: SessionCompactor         # 会话压缩器
    allowed_tools: Optional[Set[str]]   # 工具白名单 (None=全部)
```

### 4.2 run_turn() 执行流程

```
run_turn(user_input, api_client, tool_executor, on_text, on_tool, on_save)
│
├─ 1. 追加用户消息到 self.messages
│      self.messages.append(ConversationMessage.user_text(user_input))
│      if on_save: on_save("user", user_input)
│
├─ 2. 进入迭代循环 (max_iterations 次)
│   │
│   ├─ 2a. 构建 ApiRequest
│   │      request = ApiRequest(model, self.messages, self.system_prompt, tools)
│   │
│   ├─ 2b. 调用 LLM
│   │      blocks, usage = api_client.stream(request)
│   │      self.messages.append(ConversationMessage.assistant(blocks, usage))
│   │
│   ├─ 2c. 判断响应类型
│   │   │
│   │   ├─ 无 ToolUse (talk/finish):
│   │   │   for block in msg.text_blocks:
│   │   │       on_text(block)             # 显示到 UI
│   │   │       on_save("assistant", block) # 持久化到 JSON
│   │   │   return TurnSummary(finished=True)  # ← 退出循环
│   │   │
│   │   └─ 有 ToolUse (shell/read_file/...):
│   │       for tool_use in tool_uses:
│   │         ├─ 权限检查: permission_policy.authorize(name)
│   │         ├─ 执行工具: result = tool_executor.execute(name, input)
│   │         ├─ 追加结果: self.messages.append(ToolResult(...))
│   │         ├─ on_tool(name, input, result, is_error)   # 显示工具卡片
│   │         └─ on_save("tool", result, name, args)       # 持久化
│   │
│   ├─ 2d. 收敛检测
│   │      最近 3 步同一工具+同参数 → 强制 finish (talk/finish 除外)
│   │
│   └─ 2e. 会话压缩检查
│          compactor.should_compact(total_usage) → 超过阈值则压缩
│
└─ 3. 超过 max_iterations → 返回 TurnSummary(finished=True)
```

### 4.3 收敛检测 (`_check_convergence`)

```python
def _check_convergence(self, tool_uses):
    # 记录最近 3 步 (tool_name, args_key) 元组
    self._last_tool_steps.append((tu.name, str(sorted(tu.input.items()))))
    if len(self._last_tool_steps) > 3:
        self._last_tool_steps.pop(0)

    # 如果最近 3 步完全相同
    if len(set(self._last_tool_steps)) == 1 and len(self._last_tool_steps) == 3:
        name = self._last_tool_steps[0][0]
        if name not in ("talk", "finish"):  # talk/finish 不算死循环
            return True  # → 强制结束

    return False
```

### 4.4 memory_to_runtime_messages() — 格式转换

将 Memory 的 dict 列表转换为 ConversationMessage 序列，这是会话加载后 LLM 能"看到"历史的关键。

```python
def memory_to_runtime_messages(history: list) -> List[ConversationMessage]:
    for entry in history:
        if "input" in entry:                    # 工具调用条目
            tool = entry["input"]["tool"]
            if tool in ("talk", "finish"):
                → ConversationMessage.assistant([TextBlock(output)])
            elif tool == "user":
                → ConversationMessage.user_text(msg)
            else:                               # shell/read_file 等
                → ConversationMessage.assistant([ToolUse(id, name, args)])  # 工具调用
                → ConversationMessage.tool_result(id, output, is_error)     # 工具结果
        else:                                   # 普通消息条目
            role = entry["role"]
            if role == "user":
                → ConversationMessage.user_text(content)
            elif role == "assistant":
                → ConversationMessage.assistant([TextBlock(content)])
```

---

## 5. ApiClient — LLM 交互层

`core/llm/client.py`

### 5.1 ApiClient 结构

```python
class ApiClient:
    active_model: str = "deepseek-v4-flash"  # 类变量，热切换目标

    def __init__(self, model=""):
        self.model = model or self.active_model  # 实例变量，调用时读取类变量

    def stream(self, request: ApiRequest) -> Tuple[List[ContentBlock], TokenUsage]:
        raw_text = self._call_model_raw(request)   # 调用 LLM API
        blocks, usage = self._parse_response(raw_text)  # 解析 JSON 响应
        return blocks, usage
```

### 5.2 _parse_response — 响应解析

```
输入: LLM 原始文本 (JSON)
      ↓
1. strip() + find('{')/rfind('}')
      ↓
2. 找到完整 JSON { ... } ?
   ├─ YES → json.loads()
   │   ├─ tool="talk"/"finish" → TextBlock(text=提取的 message)
   │   └─ 其他 → ToolUse(id, name, input)
   └─ NO → 正则提取 (截断 JSON 修复)
        └─ 搜索 "text"|"message"|"content"|"response" 键的值
```

**键名回退链**：`message` → `content` → `response` → `text` → `""`

**截断 JSON 修复**：当 LLM 输出超过 token 限制导致 JSON 不完整时，用正则从残缺 JSON 中提取文本内容，而不是显示原始 JSON 字符串。

### 5.3 _format_messages — 消息格式转换

```python
ConversationMessage → OpenAI API 格式

USER:         {"role": "user", "content": "..."}
ASSISTANT:    {"role": "assistant", "content": "..."}  (仅 TextBlock)
TOOL:         {"role": "user", "content": "工具结果: ..."}  (ToolResult → user 角色)
```

### 5.4 ModelManager — 模型管理

```python
class ModelManager:
    available_models = {
        "云端模型": {
            "deepseek-v4-flash": {"name": "DeepSeek Flash", "type": "cloud"},
            "deepseek-v4-pro":   {"name": "DeepSeek Pro", "type": "cloud"},
        },
        "本地模型": {
            "gemma3:12b":   {"name": "gemma3:12b", "type": "local"},
            "gpt-oss:20b":  {"name": "gpt-oss:20b", "type": "local"},
        }
    }
    # add_custom_model / remove_custom_model / get_model_options
```

---

## 6. 回调机制

`ConversationRuntime.run_turn()` 通过 3 个回调完全解耦显示、持久化、业务逻辑。

### 回调签名

```python
def run_turn(self, user_input, api_client, tool_executor,
             on_text: Optional[Callable[[str], None]] = None,
             on_tool: Optional[Callable[[str, Dict, str, bool], None]] = None,
             on_save: Optional[Callable[[str, str], None]] = None) -> TurnSummary:
```

| 回调 | 参数 | 触发时机 | CLI 做什么 | GUI 做什么 |
|------|------|----------|------------|------------|
| `on_text` | `(text: str)` | LLM 返回 talk/finish | `print(text)` | `textChunk.emit(text)` → QML |
| `on_tool` | `(name, args, result, is_error)` | 工具执行完毕 | `print(...)` | `toolInvoked.emit(name,args,result)` → QML |
| `on_save` | `(role, content, tool_name, tool_args)` | 每条消息/工具后 | `memory.add_message/conversation` | 同左 |

### GUI 回调实现 (`worker.py`)

```python
def save_msg(role, content, tool_name="", tool_args=""):
    if role == "user":       pass  # ChatBridge 已保存
    elif role == "assistant": memory.add_message("assistant", content)
    elif role == "tool":      memory.add_conversation({
                                  "input": {"tool": tool_name, "tool_args": tool_args},
                                  "output": content,
                              })

runtime.run_turn(
    user_input, client, executor,
    on_text=lambda text: self.textChunk.emit(text + "\n"),
    on_tool=lambda name, args, result, failed:
        self.toolInvoked.emit(name, str(args),
            str(result) if not failed else f"执行失败: {result}"),
    on_save=save_msg,   # ← 统一的持久化回调
)
```

### CLI 回调实现 (`main.py`)

```python
runtime.run_turn(
    raw, client, ToolExecutor(),
    on_text=lambda block: print(block, end="", flush=True),
    on_tool=lambda name, args, result, failed: (
        print(f"\n[工具 {name}{' 失败' if failed else ''}] {str(result)[:200]}")
    ),
    on_save=save_msg,  # 同一个 save_msg 模式
)
```

---

## 7. Memory 持久化模型

`core/agent/memory.py`

### 7.1 双列表设计

```python
class Memory:
    history: List[Dict]    # 所有条目（user + tool + assistant），时间顺序
    messages: List[Dict]   # 只有 user + assistant（用于生成会话摘要）
```

### 7.2 写入路径

```
add_message(role, content)     → 写入 history + messages
add_conversation(dict)         → 只写入 history
  └─ 自动生成 output_summary（超过 1000 字符时截断）

每次写入后自动 save() → JSON
```

### 7.3 JSON 结构

```json
{
  "session_id": "2026-05-18_10-57-15",
  "filename": "2026-05-18_10-57-15",
  "history": [
    {"role": "user", "content": "查b站热点"},
    {"input": {"tool": "shell", "tool_args": "{'command':'...'}"},
     "output": "...", "output_summary": "..."},
    {"role": "assistant", "content": "B站今日热点: ..."}
  ],
  "messages": [
    {"role": "user", "content": "查b站热点"},
    {"role": "assistant", "content": "B站今日热点: ..."}
  ],
  "max_history": 100,
  "created_time": "2026-05-18T10:57:15.036281"
}
```

### 7.4 为什么需要 history 和 messages 两个列表

| | `history` | `messages` |
|------|------|------|
| 内容 | user + assistant + tool 全部 | 只有 user + assistant |
| 排序 | 时间顺序 | 时间顺序 |
| 用途 | `_rebuild_chat()` 显示 + `memory_to_runtime_messages()` LLM 上下文 | `generate_session_summary()` 会话摘要 |
| 写入 | `add_message()` + `add_conversation()` | 仅 `add_message()` |

---

## 8. 工具系统

`core/tools/`

### 8.1 三层架构

```
TOOL_DEFINITIONS (JSON Schema)
    ↓ 定义每个工具的 name / description / input_schema
    ↓ 供 ApiClient.get_tool_definitions() 读取，传入 LLM 系统提示
    ↓
TOOL_FUNCTIONS (实现)
    ↓ 函数引用映射
    ↓
TOOL_REGISTRY (运行时)
    ↓ 组装 (func, description, params)
    ↓
call_tool(name, **kwargs) → 参数别名解析 → 函数调用 → 结果
```

### 8.2 已注册别名

```python
aliases = {
    "file_path": ["path"],
    "message": ["content", "text"],
    "src": ["source", "from"],
    "dst": ["dest", "destination", "to"],
}
```

**示例**：如果 LLM 传了 `path="foo.txt"` 但工具需要 `file_path`，自动转换为 `file_path="foo.txt"`。

### 8.3 完整工具列表

| 工具 | 权限级别 | 关键参数 |
|------|----------|----------|
| `talk` | READ_ONLY | message |
| `finish` | READ_ONLY | response |
| `read_file` | READ_ONLY | file_path, search, start_line, max_lines |
| `web_search` | READ_ONLY | query |
| `web_content` | READ_ONLY | urls |
| `weather` | READ_ONLY | city, detail |
| `speaking` | READ_ONLY | text, rate, volume |
| `shell` | DANGER_FULL | command, timeout, cwd |
| `write_file` | WORKSPACE_WRITE | file_path, content, append, backup |
| `replace_content` | WORKSPACE_WRITE | file_path, old/new_content, regex, count |
| `list_directory` | READ_ONLY | path, all, pattern |
| `create_directory` | WORKSPACE_WRITE | path |
| `delete_path` | WORKSPACE_WRITE | path, recursive |
| `copy_move` | WORKSPACE_WRITE | src, dst, action |
| `grep_files` | READ_ONLY | pattern, path, include, max_results |
| `file_info` | READ_ONLY | path |
| `python_exec` | DANGER_FULL | code |

---

## 9. 权限控制

`core/runtime/permissions.py`

```python
class PermissionMode(IntEnum):
    READ_ONLY = 0        # 只能读文件/网络
    WORKSPACE_WRITE = 1  # 可写文件
    DANGER_FULL = 2      # 可执行 shell (默认)
    ALL = 3              # 全部允许

# 每个工具的权限要求
TOOL_PERMISSIONS = {
    "read_file": READ_ONLY,
    "shell": DANGER_FULL,
    "write_file": WORKSPACE_WRITE,
    ...
}

class PermissionPolicy:
    def authorize(self, tool_name: str) -> Tuple[bool, str]:
        required = TOOL_PERMISSIONS[tool_name]
        if self.mode >= required:
            return True, ""
        return False, f"当前权限模式不允许使用 {tool_name}"
```

**使用**：在 `ConversationRuntime.run_turn()` 中每个工具执行前检查：
```python
permitted, reason = self.permission_policy.authorize(tool_use.name)
if not permitted:
    result = f"权限拒绝: {reason}"  # 不执行工具
```

---

## 10. UsageTracker 与 SessionCompactor

### 10.1 UsageTracker

`core/runtime/usage.py`

```python
class UsageTracker:
    latest: TokenUsage      # 最近一轮的 token
    cumulative: TokenUsage  # 累计 token
    turns: int              # 轮次计数

    def add(self, usage): ...
    def summary(self) -> str: ...
```

在 `run_turn()` 每轮循环后更新。

### 10.2 SessionCompactor

`core/runtime/compact.py`

```python
class SessionCompactor:
    threshold: int          # 触发阈值 (默认 50000 input tokens)
    preserve_recent: int    # 保留最近 N 条消息 (默认 4)

    def should_compact(self, usage) -> bool:
        return usage.input_tokens >= self.threshold

    def compact(self, messages) -> List[ConversationMessage]:
        # 保留最近 N 条
        # 对更早的生成摘要 → 一条 SYSTEM 消息
        # 返回 [summary_msg] + preserved
```

**触发时机**：`run_turn()` 中每轮结束后检查，防止上下文过长导致 token 浪费或超出限制。

---

## 11. SystemPromptBuilder

`core/prompt/builder.py`

```python
class SystemPromptBuilder:
    def build(self) -> str:
        # 动态构建系统提示词，包含:
        self._add_intro()        # 角色定义
        self._add_environment()  # 当前平台/目录/时间
        self._add_device_info()  # OS 信息
        self._add_rules()        # JSON 格式要求 + 核心规则
        self._add_tool_usage()   # 工具使用指南 + 参数名
        self._add_output_format()# 完成条件
```

**关键设计**：`_add_tool_usage` 中**明确写出每个工具的参数名**（如 `{"message": "..."}`），防止 LLM 使用错误键名（如 `text` 而不是 `message`）。

---

## 12. CLI 执行路径

`main.py`

```
用户输入 "查b站热点"
  ↓
run_interactive_mode()
  ├─ memory = Memory(user_input="")
  ├─ runtime = ConversationRuntime(system_prompt=...)
  ├─ client = ApiClient()
  │
  └─ runtime.run_turn("查b站热点", client, ToolExecutor(),
       on_text=lambda block: print(block, end=""),
       on_tool=lambda ...: print(...),
       on_save=save_msg,
     )

save_msg:
  "user"      → pass
  "assistant" → memory.add_message("assistant", text)
  "tool"      → memory.add_conversation(...)
```

**CLI 命令**：`exit` / `help` / `clear` / `history` / `messages` / `list` / `load`

**会话加载**：
```
load <filename>
  → memory = Memory.load_session(filename)
  → runtime = ConversationRuntime(...)
  → runtime.messages = memory_to_runtime_messages(memory.history)
  → 下一轮 run_turn() 时 LLM 自动看到完整历史
```

---

## 13. GUI 执行路径

`QT/main.py` → `QT/backend/` → `QT/frontend/MARS/`

### 完整调用链

```
QML: 输入框回车
  → ChatPage.userMessage(text)
    → main.qml: onUserMessage → chatBridge.sendMessage(text)
      ↓
ChatBridge.sendMessage(text) [主线程]
  1. memory.add_message("user", text)        # 持久化用户消息
  2. messageReceived.emit("user", text)      # QML 显示用户气泡
  3. worker = ChatWorker(text, ApiClient(), memory)
  4. 连接信号: textChunk → _on_text_chunk
              toolInvoked → _on_tool_invoked
              finished → _on_worker_finished
  5. worker.start()                          # 启动子线程
      ↓
ChatWorker.run() [子线程]
  1. runtime.messages = memory_to_runtime_messages(memory.history)
  2. runtime.run_turn(user_input, client, executor, ...)
     ├─ on_text(text) → textChunk.emit(text)
     │     → [主线程] _on_text_chunk → messageReceived("ai", text) → QML
     ├─ on_tool(name,args,result,err) → toolInvoked.emit(...)
     │     → [主线程] _on_tool_invoked → toolCalled(...) → QML 工具卡片
     └─ on_save(role,content,...) → memory.add_message/conversation()
```

### 信号 → QML 映射

| Qt Signal | QML Handler | 效果 |
|-----------|-------------|------|
| `messageReceived("user", text)` | `onMessageReceived` | 追加用户气泡到 `chatModel` |
| `messageReceived("ai", text)` | `onMessageReceived` | 追加 AI 气泡到 `chatModel` |
| `toolCalled(name, args, result)` | `onToolCalled` | 追加工具卡片到 `chatModel` |
| `sessionLoaded(filename)` | `onSessionLoaded` | `chatModel = []` 清空后重建 |
| `sessionListUpdated(sessions)` | `onSessionListUpdated` | 更新侧边栏会话列表 |
| `thinkingChanged(True/False)` | `onThinkingChanged` | 禁用/启用输入框 |

---

## 14. 会话加载与上下文继承

```
用户点击侧边栏会话
  ↓
ChatPage.loadSession(filename)
  → chatBridge.loadSession(filename)
    ├─ memory = Memory.load_session(filename)
    │   └─ 读取 session/{filename}.json
    │       └─ memory.history = [...], memory.messages = [...]
    │
    ├─ sessionLoaded.emit(filename)
    │   └─ QML: chatPage.chatModel = []  ← 清空旧消息
    │
    └─ _rebuild_chat()
        └─ 遍历 memory.history (时间顺序)
            ├─ {"input":{"tool":"talk","tool_args":...},"output":"..."}
            │   → messageReceived("ai", output) → QML 显示 AI 气泡
            ├─ {"input":{"tool":"shell","tool_args":"..."},"output":"..."}
            │   → toolCalled("shell", args, output) → QML 显示工具卡片
            ├─ {"role":"user","content":"..."}
            │   → messageReceived("user", content) → QML 显示用户气泡
            └─ {"role":"assistant","content":"..."}
                → messageReceived("ai", content) → QML 显示 AI 气泡

用户在新会话中发送消息
  ↓
ChatBridge.sendMessage(text)
  → ChatWorker(text, ApiClient(), memory=已加载的memory)
    └─ worker.run()
        └─ runtime.messages = memory_to_runtime_messages(memory.history)
            # ↓ 将 history 的 dict 列表转为 ConversationMessage 序列
            # ↓ 包含: user 消息 + 所有 tool 调用 + tool 结果 + assistant 回复
            # ↓ 按时间顺序排列
            └─ runtime.run_turn("新问题", ...)
                └─ ApiRequest(messages=runtime.messages)
                    # ↓ LLM 看到的完整上下文
                    ↓
                LLM "知道"之前的所有对话
```

---

## 15. 添加新工具的完整流程

以添加 `generate_image` 工具为例：

### Step 1: 实现工具函数 (`core/tools/tools.py`)

```python
def generate_image_tool(**kwargs) -> str:
    """生成图片"""
    prompt = kwargs.get("prompt", "")
    if not prompt:
        return "Error: 缺少参数 prompt"
    # ... 调用图片生成 API ...
    return f"图片已生成: {image_url}"
```

### Step 2: 注册工具 (`core/tools/__init__.py`)

```python
# ① 添加到 TOOL_FUNCTIONS
TOOL_FUNCTIONS["generate_image"] = generate_image_tool

# ② 添加 ToolDefinition
ToolDefinition(
    name="generate_image",
    description="使用 AI 生成图片",
    input_schema={
        "type": "object",
        "properties": {
            "prompt": {"type": "string", "description": "图片描述"},
            "size": {"type": "string", "description": "尺寸，如 1024x1024"},
        },
        "required": ["prompt"]
    }
)
```

### Step 3: 设置权限 (`core/runtime/permissions.py`)

```python
TOOL_PERMISSIONS["generate_image"] = PermissionMode.READ_ONLY
```

### Step 4: 更新系统提示 (`core/prompt/builder.py`)

```python
def _add_tool_usage(self):
    ...
    self._sections.append("- 生成图片 → generate_image, tool_args: {\"prompt\": \"...\"}")
```

### Step 5 (可选): 参数别名 (`core/tools/__init__.py`)

```python
aliases = {
    ...
    "prompt": ["description", "text"],
}
```

完成。无需修改 `conversation.py`、`worker.py`、`chat_bridge.py` 或其他任何文件。
