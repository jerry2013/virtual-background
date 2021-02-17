import { useEffect, useState } from 'react'
import { InputResolutions, SegmentationConfig } from '../helpers/segmentationHelper'

declare function createTFLiteModule(): Promise<TFLite>
declare function createTFLiteSIMDModule(): Promise<TFLite>

export interface TFLite extends EmscriptenModule {
  _getModelBufferMemoryOffset(): number
  _getInputMemoryOffset(): number
  _getInputHeight(): number
  _getInputWidth(): number
  _getInputChannelCount(): number
  _getOutputMemoryOffset(): number
  _getOutputHeight(): number
  _getOutputWidth(): number
  _getOutputChannelCount(): number
  _loadModel(bufferSize: number): number
  _runInference(): number
}

let promise = Promise.resolve()

function useTFLite(segmentationConfig: SegmentationConfig) {
  const [tflite, setTFLite] = useState<TFLite>()
  const [tfliteSIMD, setTFLiteSIMD] = useState<TFLite>()
  const [selectedTFLite, setSelectedTFLite] = useState<TFLite>()
  const [isSIMDSupported, setSIMDSupported] = useState(false)

  useEffect(() => {
    async function loadTFLite() {
      createTFLiteModule().then(setTFLite)
      try {
        const createdTFLiteSIMD = await createTFLiteSIMDModule()
        setTFLiteSIMD(createdTFLiteSIMD)
        setSIMDSupported(true)
      } catch (error) {
        console.warn('Failed to create TFLite SIMD WebAssembly module.', error)
      }
    }

    loadTFLite()
  }, [])

  useEffect(() => {
    async function loadMeetModel() {
      if (
        !tflite ||
        (isSIMDSupported && !tfliteSIMD) ||
        (!isSIMDSupported && segmentationConfig.backend === 'wasmSimd') ||
        segmentationConfig.model !== 'meet'
      ) {
        return
      }

      setSelectedTFLite(undefined)

      const newSelectedTFLite =
        segmentationConfig.backend === 'wasmSimd' ? tfliteSIMD : tflite

      if (!newSelectedTFLite) {
        throw new Error(
          `TFLite backend unavailable: ${segmentationConfig.backend}`
        )
      }

      const modelFileName = InputResolutions[segmentationConfig.inputResolution][0];
      console.log('Loading meet model:', modelFileName)

      const modelResponse = await fetch(
        `${process.env.PUBLIC_URL}/models/${modelFileName}.tflite`
      )
      if (!modelResponse.ok) {
        throw new Error(`TFLite model unavailable`)
      }
      const model = await modelResponse.arrayBuffer()
      console.log('Model buffer size:', model.byteLength)

      const modelBufferOffset = newSelectedTFLite._getModelBufferMemoryOffset()
      console.log('Model buffer memory offset:', modelBufferOffset)
      newSelectedTFLite.HEAPU8.set(new Uint8Array(model), modelBufferOffset)
      const result = newSelectedTFLite._loadModel(model.byteLength)
      console.log('_loadModel result:', result)

      if (result !== 0) {
        return
      }

      console.log(
        'Input memory offset:',
        newSelectedTFLite._getInputMemoryOffset()
      )
      console.log('Input dimension:', [newSelectedTFLite._getInputWidth(), newSelectedTFLite._getInputHeight()])
      console.log('Input channels:', newSelectedTFLite._getInputChannelCount())

      console.log(
        'Output memory offset:',
        newSelectedTFLite._getOutputMemoryOffset()
      )
      console.log('Output height:', [newSelectedTFLite._getOutputWidth(), newSelectedTFLite._getOutputHeight()])
      console.log(
        'Output channels:',
        newSelectedTFLite._getOutputChannelCount()
      )

      setSelectedTFLite(newSelectedTFLite)
    }

    promise = promise.then(() => loadMeetModel())
  }, [
    tflite,
    tfliteSIMD,
    isSIMDSupported,
    segmentationConfig,
  ])

  return { tflite: selectedTFLite, isSIMDSupported }
}

export default useTFLite
