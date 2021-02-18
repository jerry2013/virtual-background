import { TextField } from '@material-ui/core'
import Card from '@material-ui/core/Card'
import CardContent from '@material-ui/core/CardContent'
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import BlockIcon from '@material-ui/icons/Block'
import BlurOnIcon from '@material-ui/icons/BlurOn'
import ImageButton from '../../shared/components/ImageButton'
import SelectionIconButton from '../../shared/components/SelectionIconButton'
import {
  BackgroundConfig,
  backgroundImageUrls,
} from '../helpers/backgroundHelper'

type BackgroundConfigCardProps = {
  config: BackgroundConfig
  onChange: (config: BackgroundConfig) => void
}

function BackgroundConfigCard(props: BackgroundConfigCardProps) {
  const classes = useStyles()

  return (
    <Card className={classes.root}>
      <CardContent>
        <Typography gutterBottom variant="h6" component="h2">
          Background
        </Typography>
        <SelectionIconButton
          active={props.config.type === 'none'}
          onClick={() => props.onChange({ type: 'none' })}
        >
          <BlockIcon />
        </SelectionIconButton>
        <SelectionIconButton
          active={props.config.type === 'blur'}
          onClick={() => props.onChange({ type: 'blur' })}
        >
          <BlurOnIcon />
        </SelectionIconButton>
        {backgroundImageUrls.map((imageUrl) => (
          <ImageButton
            key={imageUrl}
            imageUrl={imageUrl}
            active={imageUrl === props.config.url}
            onClick={() =>
              props.onChange({
                type: 'image',
                url: imageUrl,
                image: Object.assign(new Image(), { src: imageUrl }),
              })
            }
          />
        ))}
        <TextField
          label="Image URL"
          variant="outlined"
          fullWidth
          margin="normal"
          value={props.config.url || ''}
          onChange={(event) =>
            props.onChange({
              type: 'image',
              url: event.target.value,
              image: Object.assign(new Image(), {
                src: event.target.value,
                crossOrigin: 'Anonymous',
              }),
            })
          }
        />
      </CardContent>
    </Card>
  )
}

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      flex: 1,
    },
  })
)

export default BackgroundConfigCard
