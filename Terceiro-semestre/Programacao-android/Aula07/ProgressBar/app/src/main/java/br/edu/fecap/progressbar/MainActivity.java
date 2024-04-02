package br.edu.fecap.progressbar;

import androidx.appcompat.app.AppCompatActivity;

import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;


public class MainActivity extends AppCompatActivity {

    private ProgressBar progressoHorizontal;
    private ProgressBar progressoCircular;
    private int progresso = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        progressoCircular = findViewById(R.id.progress_circular);
        progressoHorizontal = findViewById(R.id.progress_barra);
        progressoCircular.setVisibility(View.GONE);
    }

    public void carregar(View view){
        this.progresso += 1;
        progressoHorizontal.setProgress(this.progresso);

        progressoCircular.setVisibility(View.VISIBLE);
        if(this.progresso >= 10){
            progressoCircular.setVisibility(View.GONE);
        }

    }

    public void resetar(View view){
        this.progresso = 0;
        progressoHorizontal.setProgress(this.progresso);
        progressoCircular.setVisibility(View.GONE);
    }
}