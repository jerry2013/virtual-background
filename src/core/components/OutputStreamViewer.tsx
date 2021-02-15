import { createStyles, makeStyles, Theme, Typography } from '@material-ui/core'
import React, { useEffect, useRef } from 'react'
import { StreamPlayback } from '../helpers/sourceHelper'

type OutputStreamViewerProps = {
  streamPlayback: StreamPlayback
}

declare global {
  interface HTMLCanvasElement {
    captureStream(frameRate?: number): MediaStream
  }
}
function OutputStreamViewer(props: OutputStreamViewerProps) {
  const classes = useStyles()
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) {
      const canvas = props.streamPlayback.canvasElement
      videoRef.current.srcObject = canvas.captureStream(30)
    }
  }, [props.streamPlayback])

  return (
    <div className={classes.root}>
      <video
        ref={videoRef}
        className={classes.playback}
        autoPlay
        playsInline
        controls={false}
        muted
      />
      <Typography className={classes.stats} variant="caption">
        Video Output
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
    playback: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
  })
)

export default OutputStreamViewer
