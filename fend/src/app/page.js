import ShopHeroBox from "./components/head";
import Comment from "./components/comment";
import Crouser from "./components/couser"
import ProductCarousel from "./components/productcarousel";
import Section from './components/section';

export default function Home() {
  return (
    <>
  <ShopHeroBox />
  <Crouser />
  <Section />
  <ProductCarousel />
  <Comment />
  
    </>
  );
}
