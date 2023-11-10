function ItemsPage() {
  return (
    <div>
        <h2>Cadastro de produtos</h2>
        <form>
        <label>Titulo: </label>
        <br></br>
        <input type="text" placeholder="Insira o titulo"/> 

        <br></br>
        <br></br>

        <label>Descrição: </label>
        <br></br>
        <textarea rows="2" cols="10"></textarea>

        <br></br>
        <br></br>

        <label>Foto: </label>
        <br></br>
        <input type="file" placeholder="Insira um arquivo"/>

        <br></br>
        <br></br>
        <br></br>
        
        <button type="submit">Enviar Produto</button>
        </form>
    </div>
  );
}

export default ItemsPage