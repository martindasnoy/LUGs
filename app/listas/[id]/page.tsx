import Home from "../../page";

type Props = {
  params: Promise<{
    id: string;
  }> | {
    id: string;
  };
};

export default async function ListaDetallePage({ params }: Props) {
  const resolvedParams = await Promise.resolve(params);
  return <Home initialSection="listas" initialListId={resolvedParams.id} />;
}
