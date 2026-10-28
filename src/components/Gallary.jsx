import Amenities from './Amenities'

const galleryAssets = import.meta.glob('../assets/Gallary/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
})

const GALLERY = Object.entries(galleryAssets)
  .sort(([first], [second]) => first.localeCompare(second))
  .map(([path, src]) => {
    const fileName = path.split('/').pop().replace(/\.webp$/i, '')
    return {
      id: fileName,
      name: fileName.replace(/_/g, ' '),
      meta: 'Gallery',
      focus: '50%',
      src,
    }
  })

export default function Gallery({ index, label, active, onBack }) {
  return (
    <Amenities
      index={index}
      label={label}
      active={active}
      onBack={onBack}
      items={GALLERY}
      getImage={(item) => item.src}
      itemType="gallery image"
    />
  )
}
