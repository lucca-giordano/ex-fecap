package br.fecap.informaes;

import androidx.appcompat.app.AppCompatActivity;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        findViewById(R.id.btn_startFinanc).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                gotoPage(MainActivity.this, "br.fecap.informaes.Financeiro");
            }
        });

        findViewById(R.id.btn_startEdu).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                gotoPage(MainActivity.this, "br.fecap.informaes.Educacao");
            }
        });

        findViewById(R.id.btn_startSaude).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                gotoPage(MainActivity.this, "br.fecap.informaes.Saude");
            }
        });

        findViewById(R.id.btn_startInfo).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                gotoPage(MainActivity.this, "br.fecap.informaes.Informacoes");
            }
        });


    }

    public void gotoPage(Context context, String pageClassName){
        try {
            Class<?> clazz = Class.forName(pageClassName);
            Intent intent = new Intent(context, clazz);
            context.startActivity(intent);
            finish();
        } catch (ClassNotFoundException e) {
            throw new RuntimeException(e);
        }
    }

}