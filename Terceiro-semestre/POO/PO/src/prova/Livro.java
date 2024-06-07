package prova;

public class Livro extends Publicacao{
	
	private String editora;
	


	public Livro(String titulo, String dataPublicacao, String editora) {
		super(titulo, dataPublicacao);
		this.editora = editora;
	}
	
	
	public String getEditora() {
		return editora;
	}

	public void setEditora(String editora) {
		this.editora = editora;
	}

	public void imprimir() {
		
	}
	
	

}
