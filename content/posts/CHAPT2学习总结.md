---
title: "ROS2 基础：节点创建与多线程"
date: 2026-06-16
tags: ["ROS2", "Python", "学习笔记"]
summary: "CHAPT2 学习笔记：节点创建、类继承、日志系统、多线程下载。"
---

# CHAPT2 ROS2 基础学习笔记

> 节点创建、继承、多线程下载

---

## 一、最简单节点

### 1.1 代码结构

```python
import rclpy
from rclpy.node import Node

def main(args=None):
    rclpy.init(args=args)  # 初始化 ROS2
    node = Node('node_name')  # 创建节点
    node.get_logger().info('消息')  # 日志输出
    rclpy.spin(node)  # 保持节点运行
    node.destroy_node()
    rclpy.shutdown()
```

### 1.2 日志级别

```python
node.get_logger().info('信息')
node.get_logger().warn('警告')
node.get_logger().error('错误')
```

---

## 二、类继承节点

### 2.1 自定义节点类

```python
class PersonNode(Node):
    def __init__(self, name: str, age: int, node_name: str):
        super().__init__(node_name)  # 必须调用父类初始化
        self.name = name
        self.age = age
    
    def eat(self, food_name: str):
        self.get_logger().info(f'{self.name}, {self.age}岁 is eating {food_name}')
```

### 2.2 继承扩展

```python
class WriterNode(PersonNode):
    def __init__(self, name, age, book: str, node_name: str):
        super().__init__(name, age, node_name)  # 调用父类
        self.book = book
    
    def write(self):
        self.get_logger().info(f"正在编写 {self.book}")
```

---

## 三、多线程下载

### 3.1 核心代码

```python
import threading
import requests

class Download:
    def download(self, url, callback, max_retries=3):
        """单线程下载，支持重试"""
        for attempt in range(max_retries):
            try:
                response = requests.get(url, timeout=3)
                callback(url, response.text)
                return
            except Exception as e:
                print(f"失败 ({attempt+1}/{max_retries}): {url}")
    
    def start_download(self, urls, callback, delay=0.5):
        """多线程下载"""
        threads = []
        for i, url in enumerate(urls):
            if i > 0:
                time.sleep(delay)
            thread = threading.Thread(target=self.download, args=(url, callback))
            thread.start()
            threads.append(thread)
        
        for thread in threads:
            thread.join()  # 等待所有线程完成
```

---

## 四、要点总结

| 知识点 | 关键点 |
|--------|--------|
| 节点创建 | `rclpy.init()` → `Node()` → `rclpy.spin()` |
| 日志输出 | `node.get_logger().info()` |
| 类继承 | `super().__init__(node_name)` 必须调用 |
| 多线程 | `threading.Thread` + `join()` 等待 |

---

## 五、运行命令

```bash
# 编译
colcon build

# 运行节点
ros2 run demo_python_pkg python_node
ros2 run demo_python_pkg person_node
ros2 run demo_python_pkg writer_node
```

---

## 六、文件索引

| 文件 | 功能 |
|------|------|
| `python_node.py` | 最简单节点示例 |
| `person_node.py` | 类继承节点 |
| `writer_node.py` | 继承扩展 |
| `learn_thread.py` | 多线程下载 |