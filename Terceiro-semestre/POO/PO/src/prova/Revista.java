package prova;

public class Revista extends Publicacao{
	
	private String editor;
	private String local;
	

	
	public Revista(String titulo, String dataPublicacao, String editor, String local) {
		super(titulo, dataPublicacao);
		this.editor = editor;
		this.local = local;
	}
	
	
	public String getEditor() {
		return editor;
	}
	public void setEditor(String editor) {
		this.editor = editor;
	}
	public String getLocal() {
		return local;
	}
	public void setLocal(String local) {
		this.local = local;
	}
	
	public void leitura() {
		
	}

	public void imprimir() {
		
	}

}
