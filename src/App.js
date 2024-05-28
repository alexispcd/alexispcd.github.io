import Main from "./pages/Main";
import { BrowserRouter, Routes, Route } from "react-router-dom";

function App() {
  return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Main />} />
          <Route path="*" element={<Main />} />
        </Routes>
      </BrowserRouter>
  );
}

export default App;
