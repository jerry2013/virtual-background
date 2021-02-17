export type SegmentationModel = 'bodyPix' | 'meet'
export type SegmentationBackend = 'webgl' | 'wasm' | 'wasmSimd'
export type InputResolution = '360p' | '144v2' | '96v2' | '144hd' | '144v3' | '96v3'

export const InputResolutions: {
  [resolution in InputResolution]: [string, [number, number], number]
} = {
  '360p': ['', [640, 360], 0],
  // 2020-12
  '144hd': ['_segm_hd_gpu_v1093', [256, 144], 1],
  '144v3': ['segm_full_sparse_v1008', [256, 144], 1],
  '96v3': ['segm_lite_v1082', [160, 96], 1],
  // 2020-10
  '144v2': ['segm_full_v679', [256, 144], 2],
  '96v2': ['segm_lite_v681', [160, 96], 2],
}

export type PipelineName = 'canvas2dCpu' | 'webgl2'

export type SegmentationConfig = {
  model: SegmentationModel
  backend: SegmentationBackend
  inputResolution: InputResolution
  pipeline: PipelineName
}
