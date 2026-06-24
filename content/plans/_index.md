---
title: "计划"
---

## 六轴机械臂项目（Dummy V2 + PD42S1）

### 阶段0：环境搭建与源码通读（2周）

- [ ] Day 1-3：搭建 STM32 开发环境（STM32CubeIDE/VSCode+CMake、ST-Link 驱动、Wireshark+CAN 插件），Dummy V2 固件编译通过
- [ ] Day 4-6：通读 ref-controller 主控固件架构（main.cpp → dummy_robot → ctrl_step → 6dof_kinematic），画出系统架构图
- [ ] Day 7-9：通读关节驱动固件（motor.cpp Tick20kHz 闭环控制、编码器校准、CAN 接收处理），理清帧到电机的数据流
- [ ] Day 10-12：PD42S1 单轴硬件上手（接线供电、编码器校准、工作模式设置、面板控制电机正反转回零）
- [ ] Day 13-14：用 USB-CAN 工具手动发送 CAN 帧验证通信（使能/绝对位置/读位置/失能），记录完整帧数据和校验和计算

### 阶段1：PD42S1 单轴通信适配（4周）

- [ ] Day 15-17：设计 PD42S1Driver 类框架（对外接口与 CtrlStepMotor 一致，内部封装扩展帧/校验和/角度↔脉冲转换）
- [ ] Day 18-20：实现 CAN 发送层（扩展帧 ExtId 配置、SendFrame/CalcChecksum/ParseResponse 函数），编译通过
- [ ] Day 21-23：单轴调试 Step1-3（CAN 物理层验证 → 单帧使能 → 绝对位置移动 1 圈验证）
- [ ] Day 24-26：单轴调试 Step4-5（连续平滑运动 → 双向通信读位置，串口打印角度与 LCD 一致 < 0.1°）
- [ ] Day 27-28：三种模式全量验证（位置/速度/力矩），整理常见问题排查表

### 阶段2：六轴驱动与固件移植（6周）

- [ ] Day 29-31：六轴地址分配（J1-J6 对应 CAN ID 0x1001-0x1006）、CAN 总线菊花链布线、120Ω 终端电阻配置
- [ ] Day 32-34：6 个 PD42S1 逐一挂上 CAN 总线，每个关节独立跑通阶段1全部调试步骤
- [ ] Day 35-37：适配 DummyRobot 类（替换 CtrlStepMotor 为 PD42S1Driver，处理 ACK 超时/单位转换/广播使能差异）
- [ ] Day 38-40：处理 DummyHand 夹爪（GPIO+舵机替代或暂时去掉），CLI-Tool 可控制全部 6 轴
- [ ] Day 41-43：机械臂组装接线（CAN 串联、24V/20A 电源分配、急停按钮），完成编码器校准
- [ ] Day 44-46：关节标定（零点标定 → 限位验证 → 方向验证 → 减速比验证），执行预设 6 轴联动轨迹

### 阶段3：运动学与轨迹规划（4周）

- [ ] Day 47-49：精读《机器人学导论》第 2-4 章（DH 参数建模、正运动学齐次变换、逆运动学解析法/数值法）
- [ ] Day 50-52：逐行精读 6dof_kinematic.cpp（DH 参数表、InverseKinematics 输入输出、奇异点检测处理）
- [ ] Day 53-55：Python Robotics Toolbox 搭建 Dummy V2 仿真模型，正逆运动学计算结果与固件一致（误差 < 0.01°）
- [ ] Day 56-58：关节空间轨迹规划（梯形速度曲线 → S 型速度曲线，理解原版 trapezoidal 实现）
- [ ] Day 59-62：笛卡尔空间直线插补（位姿插值 + 逐点逆运动学），激光笔验证末端走直线（偏差 < 5mm）

### 阶段4：ROS2/MoveIt2 集成（6周）

- [ ] Day 63-65：编写 Dummy V2 的 URDF/xacro 文件（连杆几何 STL、关节限位、惯性矩阵、碰撞模型）
- [ ] Day 66-68：MoveIt2 Setup Assistant 配置（规划组、末端执行器、KDL/TRAC-IK 求解器、控制器接口）
- [ ] Day 69-71：RViz2 加载 3D 模型，鼠标拖拽规划运动，MoveIt2 自动生成轨迹并显示
- [ ] Day 72-74：编写 ros2_control Hardware Interface 插件（USB 串口 ↔ STM32 ↔ CAN ↔ PD42S1 通信链路）
- [ ] Day 75-77：Gazebo 仿真环境搭建（物理引擎配置：关节摩擦、重力、碰撞），仿真中验证 MoveIt2 规划
- [ ] Day 78-80：实机验证（点位精度 < 1mm、圆形轨迹跟踪、pick-and-place 演示视频）

### 阶段5：高级功能（持续迭代）

- [ ] 机器视觉：Eye-in-Hand 摄像头 + OpenCV 颜色检测 + 手眼标定（Tsai-Lenz）
- [ ] 目标检测：YOLO + RealSense 深度相机 + GraspNet 抓取位姿计算
- [ ] 力控入门：电流环估算力矩（PD42S1 功能码 0x23），实现轻触检测 / 恒力按压
- [ ] 动力学补偿：牛顿-欧拉法建模 + 前馈重力补偿，减小 PID 稳态误差
- [ ] 数字孪生：Mujoco/Isaac Sim 高精度仿真，实机状态实时同步

## 进行中

- [ ] 完成 ROS2 导航模块学习
- [ ] 整理博客定制化文档
- [ ] 学习 Docker 容器化部署

## 待开始

- [ ] 研究 WebAssembly 在机器人仿真中的应用
- [ ] 搭建本地 LLM 推理环境

## 已完成

- [x] 搭建个人博客并部署到 GitHub Pages
- [x] 完成 ROS2 基础节点通信学习
- [x] 完成 Nav2 自主导航巡逻项目
