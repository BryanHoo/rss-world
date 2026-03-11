import ReaderApp from './ReaderApp';

export default function ReaderPage() {
  return <ReaderApp renderedAt={new Date().toISOString()} />;
}
