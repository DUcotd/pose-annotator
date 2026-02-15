module.exports = {
  port: process.env.PORT || 5000,
  projectsDir: null,
  defaultProjectsDirName: 'projects',
  additionalProjectPaths: [],
  maxLogLines: 1000,
  python: {
    defaultPaths: [
      'python',
      'python3',
      'D:\\miniconda3\\python.exe',
      'D:\\miniconda3\\envs\\llm-gpu\\python.exe',
      'C:\\Python310\\python.exe'
    ],
    requiredPackages: ['ultralytics', 'torch']
  },
  training: {
    defaultModel: 'yolov8n.pt',
    defaultEpochs: 100,
    defaultBatch: 8,
    defaultImgsz: 640,
    pollInterval: 2000,
    maxRetries: 3
  },
  export: {
    defaultKeypoints: 17,
    defaultTrainRatio: 0.8,
    defaultValRatio: 0.2,
    defaultTestRatio: 0
  }
};
