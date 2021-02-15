import { createStyles, makeStyles, Theme } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { BodyPix } from '@tensorflow-models/body-pix'
import React, { useEffect } from 'react'
import { BackgroundConfig } from '../helpers/backgroundHelper'
import { PostProcessingConfig } from '../helpers/postProcessingHelper'
import { SegmentationConfig } from '../helpers/segmentationHelper'
import { SourcePlayback, StreamPlayback } from '../helpers/sourceHelper'
import useRenderingPipeline from '../hooks/useRenderingPipeline'
import { TFLite } from '../hooks/useTFLite'

type OutputViewerProps = {
  sourcePlayback: SourcePlayback
  backgroundConfig: BackgroundConfig
  segmentationConfig: SegmentationConfig
  postProcessingConfig: PostProcessingConfig
  bodyPix: BodyPix
  tflite: TFLite
  onLoad: (streamPlayback: StreamPlayback) => void
}

function OutputViewer(props: OutputViewerProps) {
  const classes = useStyles()
  const {
    pipeline,
    backgroundImageRef,
    canvasRef,
    fps,
    durations: [resizingDuration, inferenceDuration, postProcessingDuration],
  } = useRenderingPipeline(
    props.sourcePlayback,
    props.backgroundConfig,
    props.segmentationConfig,
    props.bodyPix,
    props.tflite
  )

  const { onLoad } = props

  useEffect(() => {
    if (pipeline) {
      pipeline.updatePostProcessingConfig(props.postProcessingConfig)
    }
  }, [pipeline, props.postProcessingConfig])

  useEffect(() => {
    onLoad({
      canvasElement: canvasRef.current,
    })
  }, [onLoad, canvasRef, props.postProcessingConfig, props.segmentationConfig])

  const statDetails: [string, number][] = [
    ['resize', resizingDuration],
    ['inference', inferenceDuration],
    ['compose', postProcessingDuration],
  ]
  return (
    <div className={classes.root}>
      {props.backgroundConfig.type === 'image' && (
        <img
          ref={backgroundImageRef}
          className={classes.render}
          src={props.backgroundConfig.url}
          alt=""
          hidden={
            !props.postProcessingConfig.useImageLayer ||
            props.segmentationConfig.pipeline === 'webgl2'
          }
        />
      )}
      <canvas
        // The key attribute is required to create a new canvas when switching
        // context mode
        key={props.segmentationConfig.pipeline}
        ref={canvasRef}
        className={classes.render}
        width={props.sourcePlayback.width}
        height={props.sourcePlayback.height}
      />
      <Typography className={classes.stats} variant="caption">
        {`${canvasRef.current?.height}p ${Math.round(fps)}fps`}
        <br />
        {`${statDetails
          .map(
            ([key, val]) => `${key} ${val && val.toFixed(2).padStart(5, '0')}ms`
          )
          .join(', ')}`}
      </Typography>
    </div>
  )
}

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      flex: 1,
      position: 'relative',
    },
    render: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    stats: {
      position: 'absolute',
      top: 0,
      right: 0,
      left: 0,
      textAlign: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.48)',
      color: theme.palette.common.white,
    },
  })
)

export default OutputViewer
