import Home from "../../page";

type Props = {
  params: {
    id: string;
  };
};

export default function ListaDetallePage({ params }: Props) {
  return <Home initialSection="listas" initialListId={params.id} />;
}
