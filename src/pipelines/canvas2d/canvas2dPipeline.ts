import { BodyPix } from '@tensorflow-models/body-pix'
import { BackgroundConfig } from '../../core/helpers/backgroundHelper'
import { PostProcessingConfig } from '../../core/helpers/postProcessingHelper'
import {
  InputResolutions,
  SegmentationConfig
} from '../../core/helpers/segmentationHelper'
import { SourcePlayback } from '../../core/helpers/sourceHelper'
import { TFLite } from '../../core/hooks/useTFLite'

export function buildCanvas2dPipeline(
  sourcePlayback: SourcePlayback,
  backgroundConfig: BackgroundConfig,
  segmentationConfig: SegmentationConfig,
  canvas: HTMLCanvasElement,
  bodyPix: BodyPix,
  tflite: TFLite,
  addFrameEvent: () => void
) {
  const ctx = canvas.getContext('2d', { desynchronized: true })!
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';

  const [segmentationWidth, segmentationHeight] = InputResolutions[
    segmentationConfig.inputResolution
  ][1]
  const segmentationPixelCount = segmentationWidth * segmentationHeight
  const segmentationMask = new ImageData(segmentationWidth, segmentationHeight)
  const segmentationMaskCanvas = document.createElement('canvas')
  segmentationMaskCanvas.width = segmentationWidth
  segmentationMaskCanvas.height = segmentationHeight
  const segmentationMaskCtx = segmentationMaskCanvas.getContext('2d')!

  const inputMemoryOffset = tflite._getInputMemoryOffset() / 4
  const outputMemoryOffset = tflite._getOutputMemoryOffset() / 4

  let postProcessingConfig: PostProcessingConfig

  const supportFilter = 'filter' in CanvasRenderingContext2D.prototype;

  async function render() {
    if (backgroundConfig.type !== 'none') {
      resizeSource()
    }

    addFrameEvent()

    if (backgroundConfig.type !== 'none') {
      if (segmentationConfig.model === 'bodyPix') {
        await runBodyPixInference()
      } else {
        runTFLiteInference()
      }
    }

    addFrameEvent()

    runPostProcessing()
  }

  function updatePostProcessingConfig(
    newPostProcessingConfig: PostProcessingConfig
  ) {
    postProcessingConfig = newPostProcessingConfig
  }

  function cleanUp() {
    // Nothing to clean up in this rendering pipeline
  }

  function resizeSource() {
    segmentationMaskCtx.drawImage(
      sourcePlayback.htmlElement,
      0,
      0,
      sourcePlayback.width,
      sourcePlayback.height,
      0,
      0,
      segmentationWidth,
      segmentationHeight
    )

    if (segmentationConfig.model === 'meet') {
      const imageData = segmentationMaskCtx.getImageData(
        0,
        0,
        segmentationWidth,
        segmentationHeight
      )

      for (let i = 0; i < segmentationPixelCount; i++) {
        for (let j = 0; j < 3; j++) {
          tflite.HEAPF32[inputMemoryOffset + i * 3 + j] = imageData.data[i * 4 + j] / 255
        }
      }
    }
  }

  async function runBodyPixInference() {
    const segmentation = await bodyPix.segmentPerson(segmentationMaskCanvas)
    for (let i = 0; i < segmentationPixelCount; i++) {
      // Sets only the alpha component of each pixel
      segmentationMask.data[i * 4 + 3] = segmentation.data[i] ? 255 : 0
    }
    segmentationMaskCtx.putImageData(segmentationMask, 0, 0)
  }

  function runTFLiteInference() {
    tflite._runInference()

    const outputChannels = InputResolutions[segmentationConfig.inputResolution][2]
    for (let i = 0; i < segmentationPixelCount; i++) {
      let mask;
      const pos = outputMemoryOffset + i * outputChannels
      if (outputChannels === 1) {
        const person = tflite.HEAPF32[pos]
        mask = person;
      } else {
        const background = tflite.HEAPF32[pos]
        const person = tflite.HEAPF32[pos + 1]
        const shift = Math.max(background, person)
        const backgroundExp = Math.exp(background - shift)
        const personExp = Math.exp(person - shift)
        mask = personExp / (backgroundExp + personExp) // softmax
      }
      // Sets only the alpha component of each pixel
      segmentationMask.data[i * 4 + 3] = 255 * mask;
    }
    segmentationMaskCtx.putImageData(segmentationMask, 0, 0)
  }

  function runPostProcessing() {
    // Only the new shape is shown.
    ctx.globalCompositeOperation = 'copy'

    if (backgroundConfig.type !== 'none') {
      if (postProcessingConfig?.smoothSegmentationMask) {
        switch (backgroundConfig.type) {
          case 'blur':
            ctx.filter = 'blur(8px)' // FIXME Does not work on Safari
            break;
          case 'image':
            ctx.filter = 'blur(4px)' // FIXME Does not work on Safari
            break;
          default: // 'none'
            break;
        }
      }
      drawSegmentationMask()
      // The new shape is drawn only where both the new shape and the
      // destination canvas overlap. Everything else is made transparent.
      ctx.globalCompositeOperation = 'source-in'
    }

    ctx.filter = 'none'
    ctx.drawImage(sourcePlayback.htmlElement, 0, 0)

    if (backgroundConfig.type !== 'none') {
      blurBackground(backgroundConfig.type === 'blur')
    }
  }

  function drawSegmentationMask() {
    ctx.drawImage(
      segmentationMaskCanvas,
      0,
      0,
      segmentationWidth,
      segmentationHeight,
      0,
      0,
      sourcePlayback.width,
      sourcePlayback.height
    )
  }

  function blurBackground(blur: boolean) {
    // New shapes are drawn behind the existing canvas content.
    ctx.globalCompositeOperation = 'destination-over'
    if (blur) {
      const radius = postProcessingConfig.jointBilateralFilter.sigmaSpace;
      if (supportFilter) {
        ctx.filter = `blur(${radius}px)` // FIXME Does not work on Safari
      } else {
        let r = 2;
        do {
          ctx.globalAlpha = r / 2 / radius;
          ctx.drawImage(sourcePlayback.htmlElement, r, -r);
          ctx.drawImage(sourcePlayback.htmlElement, -r, -r);
          r *= 2;
        } while (r <= radius * 2)
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(sourcePlayback.htmlElement, 0, 0)
    } else if (!postProcessingConfig?.useImageLayer) {
      const img = backgroundConfig.image;
      if (img && img.naturalHeight) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      }
    }
  }

  return { render, updatePostProcessingConfig, cleanUp }
}
