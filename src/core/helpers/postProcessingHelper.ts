export type BlendMode = 'screen' | 'linearDodge'

export type PostProcessingConfig = {
  smoothSegmentationMask: boolean
  useImageLayer: boolean
  jointBilateralFilter: JointBilateralFilterConfig
  coverage: [number, number]
  lightWrapping: number
  blendMode: BlendMode
}

export type JointBilateralFilterConfig = {
  sigmaSpace: number
  sigmaColor: number
}
