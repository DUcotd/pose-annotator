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
    requiredPackages: ['ultralytics', 'torch'],
    versionRequirements: {
      python: { min: '3.8.0', max: '3.12.0', recommended: '3.10.0' },
      pytorch: { min: '1.13.0', max: null, recommended: '2.1.0' },
      ultralytics: { min: '8.0.0', max: null, recommended: '8.1.0' }
    },
    incompatibleVersions: {
      pytorch: ['2.0.0', '2.0.1'],
      python: ['3.7.0', '3.7.1', '3.7.2', '3.7.3', '3.7.4', '3.7.5', '3.7.6', '3.7.7', '3.7.8', '3.7.9', '3.7.10', '3.7.11']
    },
    compatibilityMatrix: {
      cuda118: {
        cudaVersion: '11.8',
        pytorch: '2.1.0',
        pytorchIndex: 'https://download.pytorch.org/whl/cu118',
        ultralytics: '8.1.0',
        python: ['3.8', '3.9', '3.10', '3.11']
      },
      cuda121: {
        cudaVersion: '12.1',
        pytorch: '2.2.0',
        pytorchIndex: 'https://download.pytorch.org/whl/cu121',
        ultralytics: '8.1.0',
        python: ['3.8', '3.9', '3.10', '3.11', '3.12']
      },
      cuda124: {
        cudaVersion: '12.4',
        pytorch: '2.4.0',
        pytorchIndex: 'https://download.pytorch.org/whl/cu124',
        ultralytics: '8.2.0',
        python: ['3.8', '3.9', '3.10', '3.11', '3.12']
      },
      cpu: {
        cudaVersion: null,
        pytorch: '2.1.0',
        pytorchIndex: 'https://download.pytorch.org/whl/cpu',
        ultralytics: '8.1.0',
        python: ['3.8', '3.9', '3.10', '3.11', '3.12']
      }
    }
  },
  training: {
    defaultModel: 'yolov8n.pt',
    defaultEpochs: 200,
    defaultBatch: 16,
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
